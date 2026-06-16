import { wrapEffect } from '@react-three/postprocessing'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Matrix4, Uniform, Vector2, Vector3, type WebGLRenderTarget, type WebGLRenderer } from 'three'

import { blackHoleLens } from '@/scenes/system/blackHoleLens'

/**
 * 블랙홀 측지선 레이마칭 (결정 5의 high 티어 후순위 사치 — 진짜 중력렌즈).
 *
 * 화면의 BH 영역에서 픽셀마다 카메라 광선을 슈바르츠실트 시공간으로 RK4 적분한다(hexontos/
 * rendering-black-hole 레퍼런스의 측지선 ODE). 광선이 강착원반 평면을 가르면 디스크 색(온도
 * 그라데이션 + 도플러), 사건지평선에 포획되면 검은 그림자, 탈출하면 휘어진 방향으로 배경(입력
 * 버퍼)을 샘플한다. → 인터스텔라 가르강튀아 룩: 옆모습 원반 + 먼 쪽이 위로 감김 + 아인슈타인
 * 링. *깊이 인식*(탈출 광선만 배경 샘플)이라 앞 물체가 그림자에 끌려들지 않는다.
 *
 * 성능: BH 화면 영향권 밖은 패스스루, 빈 공간은 직선으로 건너뛰어(START_R 진입까지) 곡률
 * 구간에만 스텝을 집중. high 티어 전용 — 약한 기기는 medium으로 폴백(레이마칭 미적용).
 */

const STEPS = 140
const START_R_FACTOR = 9.0 // 이 반경(×rs)부터 측지선 적분 시작 (밖은 직선)
const ESCAPE_R_FACTOR = 45.0 // 이 반경(×rs)을 넘으면 탈출로 간주
const CAPTURE_FACTOR = 1.04 // 이 반경(×rs) 안쪽이면 포획(그림자)

const FRAGMENT = /* glsl */ `
  uniform float uActive;
  uniform vec3 uCameraPos;
  uniform mat4 uInvViewProj;
  uniform mat4 uViewProj;
  uniform vec3 uBhPos;
  uniform float uRs;
  uniform float uDiskInner;
  uniform float uDiskOuter;
  uniform vec3 uDiskNormal;
  uniform vec2 uCenter;
  uniform float uScreenRadius;
  uniform float uAspect;
  uniform float uTime;

  // 측지선 도함수 — state = vec4(r, phi, dr/dl, dphi/dl)
  vec4 geodesicRHS(vec4 s, float rs, float E) {
    float r = s.x;
    float dr = s.z;
    float dphi = s.w;
    float f = max(1.0 - rs / r, 1e-4);
    float dt = E / f;
    float rhsDr = -(rs / (2.0 * r * r)) * f * dt * dt
                  + (rs / (2.0 * r * r * f)) * dr * dr
                  + (r - rs) * dphi * dphi;
    float rhsDphi = -2.0 * dr * dphi / r;
    return vec4(dr, dphi, rhsDr, rhsDphi);
  }

  vec4 rk4(vec4 s, float dl, float rs, float E) {
    vec4 k1 = geodesicRHS(s, rs, E);
    vec4 k2 = geodesicRHS(s + 0.5 * dl * k1, rs, E);
    vec4 k3 = geodesicRHS(s + 0.5 * dl * k2, rs, E);
    vec4 k4 = geodesicRHS(s + dl * k3, rs, E);
    return s + (dl / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
  }

  // 강착원반 색 — 안쪽 뜨거운 백황 → 바깥 주황 (인터스텔라 톤)
  vec3 diskColor(float t) {
    vec3 hot = vec3(1.0, 0.92, 0.72);
    vec3 cool = vec3(1.0, 0.52, 0.2);
    return mix(hot, cool, clamp(t, 0.0, 1.0));
  }

  // 월드 방향 → 화면 UV (배경 샘플용)
  vec2 dirToScreenUv(vec3 dir) {
    vec4 clip = uViewProj * vec4(uCameraPos + dir * 1e5, 1.0);
    return (clip.xy / clip.w) * 0.5 + 0.5;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = inputColor;
    if (uActive < 0.5) return;
    // 화면 게이팅 — BH 영향권 밖이면 패스스루
    vec2 dScreen = vec2((vUv.x - uCenter.x) * uAspect, vUv.y - uCenter.y);
    if (length(dScreen) > uScreenRadius) return;

    float rs = uRs;
    // 카메라 광선 복원
    vec4 farP = uInvViewProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 rayDir = normalize(farP.xyz / farP.w - uCameraPos);
    vec3 ro = uCameraPos - uBhPos; // BH 프레임 원점

    // 충돌 매개변수(직선 최근접) + 빈 공간 건너뛰기
    float b = length(cross(ro, rayDir));
    float startR = START_R_FACTOR_PLACEHOLDER * rs;
    float r0 = length(ro);
    if (b >= startR) return; // 강한 곡률권 밖 — 거의 직진(배경) → 패스스루
    if (r0 > startR) {
      float tc = -dot(ro, rayDir);
      float tEnter = tc - sqrt(max(startR * startR - b * b, 0.0));
      if (tEnter > 0.0) ro += rayDir * tEnter; // 진입점까지 직선 advance
    }

    // 측지선 평면 셋업
    float r = length(ro);
    vec3 eR = ro / r;
    vec3 planeN = normalize(cross(ro, rayDir));
    vec3 eT = normalize(cross(planeN, eR));
    float dr = dot(rayDir, eR);
    float dphi = dot(rayDir, eT) / r;
    float f = max(1.0 - rs / r, 1e-4);
    float E = f * sqrt(dr * dr + r * r * dphi * dphi);

    vec4 s = vec4(r, 0.0, dr, dphi);
    float dl = 0.22 * rs; // 스텝 (rs 비례) — 곡률권에 집중
    vec3 prevPos = ro;
    float prevSide = dot(ro, uDiskNormal);

    vec3 diskCol = vec3(0.0);
    bool hitDisk = false;
    bool captured = false;
    bool escaped = false;
    vec3 outDir = rayDir;

    for (int i = 0; i < ${STEPS}; i++) {
      s = rk4(s, dl, rs, E);
      r = s.x;
      float phi = s.y;
      vec3 pos = r * (cos(phi) * eR + sin(phi) * eT);

      // 강착원반 평면 교차 — 불투명: 처음 맞은 디스크에서 광선 종료(배경 비침 없음)
      float side = dot(pos, uDiskNormal);
      if (prevSide * side < 0.0) {
        float tt = prevSide / (prevSide - side);
        vec3 hit = mix(prevPos, pos, clamp(tt, 0.0, 1.0));
        vec3 inPlane = hit - uDiskNormal * dot(hit, uDiskNormal);
        float rad = length(inPlane);
        if (rad >= uDiskInner && rad <= uDiskOuter) {
          float radialT = (rad - uDiskInner) / (uDiskOuter - uDiskInner);
          vec3 col = diskColor(radialT);
          // 도플러 — 디스크 접선속도(케플러 방향)의 관측자 성분 (한쪽 증광)
          vec3 radialDir = inPlane / max(rad, 1e-4);
          vec3 orbitVel = normalize(cross(uDiskNormal, radialDir));
          vec3 toCam = normalize((uCameraPos - uBhPos) - hit);
          float beam = dot(orbitVel, toCam);
          float doppler = clamp(1.0 + 0.95 * beam, 0.32, 1.85);
          // 부드러운 회전 셔머(약하게) + 안쪽 밝게
          float swirl = 0.88 + 0.12 * sin(atan(inPlane.z, inPlane.x) * 5.0 + uTime * 1.2 - radialT * 6.0);
          float bright = (0.22 + 0.42 * (1.0 - radialT)) * doppler * swirl;
          diskCol = col * bright;
          hitDisk = true;
          break; // 불투명 디스크 — 광선 종료
        }
      }
      prevSide = side;
      prevPos = pos;

      if (r <= rs * CAPTURE_FACTOR_PLACEHOLDER) { captured = true; break; }
      if (r >= ESCAPE_R_FACTOR_PLACEHOLDER * rs && i > 3) {
        outDir = normalize(
          s.z * (cos(phi) * eR + sin(phi) * eT) + r * s.w * (-sin(phi) * eR + cos(phi) * eT)
        );
        escaped = true;
        break;
      }
    }

    // 임계 충돌매개변수 — b < 3√3/2·rs(≈2.598) 광선은 광자구 안으로 포획된다(깨끗한 원형 그림자).
    float bCrit = 2.598 * rs;
    vec3 col;
    if (hitDisk) {
      col = diskCol; // 불투명 강착원반
    } else if (b < bCrit) {
      col = vec3(0.0); // 광자구 안 — 그림자 (배경 비침/얼룩 방지)
    } else if (escaped) {
      vec2 bgUv = dirToScreenUv(outDir);
      // 그림자 근처(b가 작을수록)는 휘어진 배경을 어둡게 — 희소한 별밭이 얼룩으로 보이는 것 완화.
      float bgFade = smoothstep(bCrit, bCrit * 3.6, b);
      col = (bgUv.x >= 0.0 && bgUv.x <= 1.0 && bgUv.y >= 0.0 && bgUv.y <= 1.0)
        ? texture2D(inputBuffer, bgUv).rgb * bgFade
        : vec3(0.0);
    } else {
      col = vec3(0.0); // 포획 — 사건지평선 그림자
    }
    outputColor = vec4(col, 1.0);
  }
`
  .replace('START_R_FACTOR_PLACEHOLDER', START_R_FACTOR.toFixed(1))
  .replace('CAPTURE_FACTOR_PLACEHOLDER', CAPTURE_FACTOR.toFixed(2))
  .replace('ESCAPE_R_FACTOR_PLACEHOLDER', ESCAPE_R_FACTOR.toFixed(1))

class BlackHoleRayMarchImpl extends Effect {
  constructor() {
    super('BlackHoleRayMarch', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform<number | Vector2 | Vector3 | Matrix4>>([
        ['uActive', new Uniform(0)],
        ['uCameraPos', new Uniform(new Vector3())],
        ['uInvViewProj', new Uniform(new Matrix4())],
        ['uViewProj', new Uniform(new Matrix4())],
        ['uBhPos', new Uniform(new Vector3())],
        ['uRs', new Uniform(1)],
        ['uDiskInner', new Uniform(2.5)],
        ['uDiskOuter', new Uniform(9)],
        ['uDiskNormal', new Uniform(new Vector3(0, 1, 0))],
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
        ['uScreenRadius', new Uniform(0.2)],
        ['uAspect', new Uniform(1)],
        ['uTime', new Uniform(0)],
      ]),
    })
  }

  override update(_renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, deltaTime: number): void {
    const u = this.uniforms as Map<string, Uniform<number | Vector2 | Vector3 | Matrix4>>
    const set = (name: string, value: number): void => {
      const uniform = u.get(name)
      if (uniform != null) uniform.value = value
    }
    const copy = (name: string, value: Vector2 | Vector3 | Matrix4): void => {
      const uniform = u.get(name)
      if (uniform != null) (uniform.value as { copy(v: typeof value): void }).copy(value)
    }
    set('uActive', blackHoleLens.active ? 1 : 0)
    copy('uCameraPos', blackHoleLens.cameraPos)
    copy('uInvViewProj', blackHoleLens.invViewProj)
    copy('uViewProj', blackHoleLens.viewProj)
    copy('uBhPos', blackHoleLens.bhPos)
    set('uRs', blackHoleLens.rs)
    set('uDiskInner', blackHoleLens.diskInner)
    set('uDiskOuter', blackHoleLens.diskOuter)
    copy('uDiskNormal', blackHoleLens.diskNormal)
    copy('uCenter', blackHoleLens.center)
    set('uScreenRadius', blackHoleLens.screenRadius)
    if (inputBuffer.height > 0) set('uAspect', inputBuffer.width / inputBuffer.height)
    const time = u.get('uTime')
    if (time != null) time.value = ((time.value as number) + deltaTime) % 10000
  }
}

export const BlackHoleRayMarch = wrapEffect(BlackHoleRayMarchImpl)
