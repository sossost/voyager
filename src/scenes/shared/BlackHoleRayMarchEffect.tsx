import { wrapEffect } from "@react-three/postprocessing";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import {
  Matrix4,
  Uniform,
  Vector2,
  Vector3,
  type WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import { QUALITY_PRESETS } from "@/quality/presets";
import { blackHoleLens } from "@/scenes/system/blackHoleLens";
import { useGameStore } from "@/store";

/**
 * 블랙홀 레이마칭 중력렌즈 (결정 5의 high 티어 사치 — 가르강튀아 룩).
 *
 * 레퍼런스 dgreenheck/webgpu-black-hole(threejsroadmap)를 화면공간 포스트패스로 포팅:
 *  - 굴절(중력렌즈): **현재 비활성(LENS_STRENGTH=0)** — 나중 구현 예정. 광선 굴절·배경 휨
 *    코드 경로는 유지하고 강도만 0으로 게이팅(값만 올리면 재활성).
 *  - 그림자: 임계 충돌매개변수 b<2.598rs(광자구) = 깨끗한 검은 원(내부에 별/배경 안 샘.).
 *  - 디스크: 레퍼런스 흑체 램프 + 도플러 D³ + 값노이즈 케플러 난류(pow 샤프닝 불투명도) + 알파.
 *  - 배경: 탈출 광선 방향으로 실제 장면 샘플(깊이 인식). 렌즈 비활성이라 현재는 직선 통과.
 */

const STEPS = 140;

const FRAGMENT = /* glsl */ `
  uniform float uActive;
  uniform vec3 uCameraPos;
  uniform mat4 uInvViewProj;
  uniform mat4 uViewProj;
  uniform vec3 uBhPos;
  uniform float uRs;
  uniform float uDiskInner;
  uniform float uDiskOuter;
  uniform float uDiskEnabled; // 0=암흑(렌즈·그림자만, 절차 BH) / 1=강착원반(유니크계)
  uniform float uStreamEnabled; // 로슈엽 물질 스트림 (카리브디스 전용)
  uniform float uStreamAngle;   // 반성 방향 월드 각 — 나선 시작 각
  uniform float uStreamStartR;  // 스트림 시작 반경(월드, 반성 표면 근방)
  uniform vec3 uDiskNormal;
  uniform vec2 uCenter;
  uniform float uScreenRadius;
  uniform float uAspect;
  uniform float uTime;
  uniform float uSteps;       // 티어별 레이마칭 스텝 상한 (high 140 / med 80 / low 48)
  uniform float uSupersample; // 1=2x2 슈퍼샘플(high) / 0=단일샘플(med·low)

  // ── 적분/형상 ──
  const float STEP = 0.3;
  const float START_R = 12.0;
  const float ESCAPE_R = 28.0;
  const float CAPTURE = 1.5;
  const float BCRIT = 6.0;
  // 중력렌즈 강도 — 광선이 휘어 디스크 뒷면이 위로 감기는 가르강튀아 룩(레퍼런스 2.4).
  const float LENS_STRENGTH = 2.4;

  // ── 강착원반 (레퍼런스 dgreenheck/webgpu-black-hole 값 그대로) ──
  // 우리 디스크 반경을 레퍼런스가 튜닝한 [INNER, OUTER] 프레임으로 매핑 → 월드 스케일 무관 동일 룩.
  const float DISK_REF_INNER = 4.1;
  const float DISK_REF_OUTER = 14.5;
  const float DISK_PEAK_TEMP_K = 49780.0; // diskTemperature 49.78 × 1000 (내부 청백)
  const float DISK_OUTER_TEMP_K = 1500.0; // 외곽 주황
  const float TEMP_FALLOFF = 5.22;
  const float DOPPLER = 1.0;
  const float EDGE_IN = 0.04;
  const float EDGE_OUT = 0.5;
  // 난류 패턴 각속도 — 패턴의 세계각 이동은 φ(t) = ψ₀ − t·ROT_SPEED·k 라 **음수여야
  // +각(CCW) 순행**으로 돈다. 쌍성 궤도(bodyPositions, atan2 각 증가)·물질 스트림 감김과
  // 같은 방향 (exotic-codex 고증 — 원반은 유입 각운동량으로 만들어지므로 궤도와 순행).
  const float ROT_SPEED = -8.7;
  const float TURB_SCALE = 1.81;
  const float TURB_STRETCH = 0.75;
  const float TURB_SHARP = 7.4;
  const float TURB_CYCLE = 5.0;
  const float TURB_LAC = 2.5;
  const float TURB_PERS = 0.8;
  const float DISK_BRIGHT = 5.0;

  // ── 배경 ──
  const float STAR_DENSITY = 0.003;
  const float STAR_SIZE = 2.0;
  const float STAR_BRIGHT = 1.0;
  const float NEB1_SCALE = 2.0;
  const float NEB1_DENSITY = 0.5;
  const float NEB1_BRIGHT = 0.15;
  const float NEB2_SCALE = 6.0;
  const float NEB2_DENSITY = 0.5;
  const float NEB2_BRIGHT = 0.15;

  vec2 dirToScreenUv(vec3 dir) {
    vec4 clip = uViewProj * vec4(uCameraPos + dir * 1e5, 1.0);
    return (clip.xy / clip.w) * 0.5 + 0.5;
  }

  // 가르강튀아 황금빛 — 외곽 앰버 → 중간 금 → 내부 백금. 빨강·파랑 배제, 전체 금색.
  vec3 blackbody(float tempK) {
    float t = clamp((tempK - 1000.0) / 9000.0, 0.0, 1.0);
    vec3 amber = vec3(1.0, 0.6, 0.24);
    vec3 gold  = vec3(1.0, 0.84, 0.5);
    vec3 white = vec3(1.0, 0.97, 0.88);
    vec3 c = mix(amber, gold, smoothstep(0.0, 0.55, t));
    return mix(c, white, smoothstep(0.6, 1.0, t));
  }

  // Perlin gradient noise — value noise 대신. 격자 경계 C1 연속 → grain/줄무늬 없음.
  vec3 gradHash(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return normalize(-1.0 + 2.0 * fract(sin(p) * 43758.5453));
  }
  float perlin3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic
    float n = mix(
      mix(mix(dot(gradHash(i),               f),
              dot(gradHash(i+vec3(1,0,0)),   f-vec3(1,0,0)), u.x),
          mix(dot(gradHash(i+vec3(0,1,0)),   f-vec3(0,1,0)),
              dot(gradHash(i+vec3(1,1,0)),   f-vec3(1,1,0)), u.x), u.y),
      mix(mix(dot(gradHash(i+vec3(0,0,1)),   f-vec3(0,0,1)),
              dot(gradHash(i+vec3(1,0,1)),   f-vec3(1,0,1)), u.x),
          mix(dot(gradHash(i+vec3(0,1,1)),   f-vec3(0,1,1)),
              dot(gradHash(i+vec3(1,1,1)),   f-vec3(1,1,1)), u.x), u.y),
      u.z);
    return n * 0.5 + 0.5;
  }
  float fbm(vec3 p, float lac, float pers) {
    float v = 0.0; float amp = 0.5; vec3 q = p;
    v += perlin3D(q) * amp; q *= lac; amp *= pers;
    v += perlin3D(q) * amp; q *= lac; amp *= pers;
    v += perlin3D(q) * amp;
    return v;
  }

  // 값 노이즈 — 레퍼런스 강착원반 난류 전용 (격자 smoothstep 보간). 배경용 Perlin과 별개.
  float vhash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float vnoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = vhash31(i);
    float b = vhash31(i + vec3(1.0, 0.0, 0.0));
    float c = vhash31(i + vec3(0.0, 1.0, 0.0));
    float d = vhash31(i + vec3(1.0, 1.0, 0.0));
    float e = vhash31(i + vec3(0.0, 0.0, 1.0));
    float f2 = vhash31(i + vec3(1.0, 0.0, 1.0));
    float g = vhash31(i + vec3(0.0, 1.0, 1.0));
    float h = vhash31(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
      mix(mix(e, f2, u.x), mix(g, h, u.x), u.y),
      u.z);
  }
  float vfbm(vec3 p, float lac, float pers) {
    float v = 0.0; float amp = 0.5; vec3 q = p;
    v += vnoise3(q) * amp; q *= lac; amp *= pers;
    v += vnoise3(q) * amp; q *= lac; amp *= pers;
    v += vnoise3(q) * amp; q *= lac; amp *= pers;
    v += vnoise3(q) * amp;
    return v;
  }

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash22(vec2 p) {
    return vec2(
      fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453),
      fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453)
    );
  }

  vec3 starField(vec3 rayDir) {
    float theta = atan(rayDir.z, rayDir.x);
    float phi = asin(clamp(rayDir.y, -1.0, 1.0));
    vec2 sc = vec2(theta, phi) * (60.0 / STAR_SIZE);
    vec2 cell = floor(sc);
    vec2 cellUV = fract(sc);
    float starProb = step(1.0 - STAR_DENSITY, hash21(cell));
    vec2 starPos = hash22(cell + 42.0) * 0.8 + 0.1;
    float distToStar = length(cellUV - starPos);
    float finalStarSize = (hash21(cell + 100.0) * 0.03 + 0.01) * STAR_SIZE;
    float starCore = smoothstep(finalStarSize, 0.0, distToStar);
    float starGlow = smoothstep(finalStarSize * 3.0, 0.0, distToStar) * 0.3;
    float starIntensity = (starCore + starGlow) * starProb;
    vec3 starColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.95, 0.8), hash21(cell + 200.0));
    return starColor * starIntensity * STAR_BRIGHT;
  }

  vec3 nebula(vec3 rayDir) {
    float n1 = fbm(rayDir * NEB1_SCALE, 2.0, 0.5) * 2.0 - 1.0;
    float layer1 = clamp(n1 + NEB1_DENSITY, 0.0, 1.0);
    vec3 c1 = vec3(0.102, 0.0, 0.2) * layer1 * NEB1_BRIGHT;
    float n2 = fbm(rayDir * NEB2_SCALE, 2.0, 0.5) * 2.0 - 1.0;
    float layer2 = clamp(n2 + NEB2_DENSITY, 0.0, 1.0);
    vec3 c2 = vec3(0.302, 0.102, 0.149) * layer2 * NEB2_BRIGHT;
    return c1 + c2;
  }

  vec4 diskSample(float hitR, float hitAngle, vec3 rayDir) {
    float normR = clamp((hitR - uDiskInner) / max(uDiskOuter - uDiskInner, 1e-4), 0.0, 1.0);
    // 우리 반경 → 레퍼런스 [4.1, 14.5] 프레임 (월드 스케일 무관 동일 룩)
    float er = mix(DISK_REF_INNER, DISK_REF_OUTER, normR);

    // 흑체색 — 외곽→피크 온도를 falloff로 보간 (내부 청백, 외곽 주황)
    float tempFalloff = pow(DISK_REF_INNER / max(er, 1e-4), TEMP_FALLOFF);
    float tempK = mix(DISK_OUTER_TEMP_K, DISK_PEAK_TEMP_K, tempFalloff);
    vec3 col = blackbody(tempK);

    // 도플러 비밍 D^3 — 다가오는 쪽이 밝고 푸르게. 물질 운동 방향은 패턴 부호와 별개로
    // 순행(CCW = 궤도·스트림과 동일) 고정 — sign(ROT_SPEED)를 쓰면 패턴 각속도 표기(음수=CCW)와
    // 얽혀 도플러가 역행으로 계산된다.
    float rotSign = 1.0;
    vec3 velDir = vec3(-sin(hitAngle) * rotSign, 0.0, cos(hitAngle) * rotSign);
    float velMag = 1.0 / sqrt(max(er / DISK_REF_INNER, 1e-3));
    // beta(궤도 속도/c)를 0.3→0.5로 — 내측 원반은 상대론적이라 다가오는 쪽이 확 밝고 멀어지는
    // 쪽이 어두운 "짝짝이"(시뮬레이션 룩). 밝은 쪽 클램프 7, 어두운 쪽 0.15(보이되 또렷이 어둡게).
    float beta = velMag * 0.5;
    float dopplerFactor = 1.0 / max(1.0 - beta * dot(velDir, rayDir), 0.05);
    col *= clamp(pow(dopplerFactor, 3.0 * DOPPLER), 0.15, 7.0);

    // 가장자리 페이드
    float edge = smoothstep(0.0, EDGE_IN, normR) * smoothstep(1.0, 1.0 - EDGE_OUT, normR);

    // 케플러 난류 — 위상 두 개를 시간 순환으로 블렌드(끊김 없는 회전)
    float cyclic = mod(uTime, TURB_CYCLE);
    float blend = cyclic / TURB_CYCLE;
    float invR15 = 1.0 / pow(max(er, 0.5), 1.5);
    float ra1 = hitAngle + cyclic * ROT_SPEED * invR15;
    float ra2 = hitAngle + (cyclic + TURB_CYCLE) * ROT_SPEED * invR15;
    float st = max(TURB_STRETCH, 0.1);
    vec3 nc1 = vec3(er * TURB_SCALE, cos(ra1) / st, sin(ra1) / st);
    vec3 nc2 = vec3(er * TURB_SCALE, cos(ra2) / st, sin(ra2) / st);
    float turb = mix(vfbm(nc2, TURB_LAC, TURB_PERS), vfbm(nc1, TURB_LAC, TURB_PERS), blend);
    float ringOpacity = pow(clamp(turb, 0.0, 1.0), TURB_SHARP);

    return vec4(col * DISK_BRIGHT, ringOpacity * edge);
  }

  // ── 로슈엽 물질 스트림 (exotic-codex, 카리브디스) ──
  // 반성(각 uStreamAngle, r=uStreamStartR)에서 원반 외곽으로 감기는 나선. 감김은 궤도
  // 진행(+각) 방향 — 각운동량 보존으로 안쪽 물질이 공전보다 빨라져 앞쪽으로 감긴다.
  const float STREAM_SWEEP = 2.45;

  float angleDiff(float a, float b) {
    return mod(a - b + 3.14159265, 6.2831853) - 3.14159265;
  }

  // 원반과 같은 y=0 평면 히트에서 호출 — (r, angle)이 나선 리본 안이면 발광을 돌려준다.
  vec4 streamSample(float r, float angle) {
    float endR = uDiskOuter * 0.98;
    float span = max(uStreamStartR - endR, 1e-3);
    float t = (uStreamStartR - r) / span;   // 0=반성 표면, 1=원반 합류
    if (t < 0.0 || t > 1.0) return vec4(0.0);

    // 나선 중심각에서의 각도 편차 → 가우시안 단면. 폭 프로파일은 로슈엽 유출 형상:
    // 별 표면에서 넓게 모인 광구(티어드롭 깔때기) → L1 노즐로 조임 → 합류부로 다시 퍼짐.
    // 깔때기(baseFlare)가 없으면 물질이 허공에서 "띡" 생겨나는 것처럼 보인다 (사용자 피드백).
    float expected = uStreamAngle + STREAM_SWEEP * t;
    float d = angleDiff(angle, expected);
    // 깔때기는 반성의 조석 티어드롭(StarSurface uTidal — L1 팁)에서 이어받는 좁은 노즐로
    // 절제한다 — 실제 L1 유출은 별 반경 대비 가늘다 (티어드롭 도입 전엔 2.6으로 과장했었다).
    float baseFlare = exp(-t * 6.0);
    float halfW = (mix(0.32, 0.78, t) + 1.3 * baseFlare) * uRs / max(r, 1e-3);
    float across = exp(-(d * d) / max(halfW * halfW, 1e-8));

    // BH 쪽(+t)으로 흘러가는 덩어리들 — 유입 물질이 "빨려드는" 독법의 핵심.
    float flow = 0.55 + 0.45 * sin(t * 24.0 - uTime * 3.0);
    float clump = 0.7 + 0.3 * sin(t * 57.0 - uTime * 5.2);
    // 덩어리는 유출점 글로우 아래에서 스며 나온다 (글로우가 탄생 지점을 덮는다).
    float birth = smoothstep(0.0, 0.06, t);
    // 유출점(L1) 글로우 — 광구가 뜯겨 나가는 지점의 느린 맥동 발광 (핫스팟의 별 쪽 대응물).
    float ld = t / 0.24;
    float l1Glow = exp(-ld * ld) * (0.95 + 0.35 * sin(uTime * 2.3));
    // 합류 핫스팟 — 스트림이 원반 가장자리를 때리는 명멸 광점 (LMXB hot spot).
    float hd = (t - 0.97) / 0.05;
    float hotspot = exp(-hd * hd) * (0.8 + 0.25 * sin(uTime * 7.3));

    // 온도 — 반성 광구(주황) → 낙하 마찰 가열(백황). 안쪽일수록 밝다.
    vec3 coolCol = vec3(1.05, 0.55, 0.28);
    vec3 hotCol = vec3(1.0, 0.92, 0.75);
    vec3 col = mix(coolCol, hotCol, smoothstep(0.3, 1.0, t));

    float a = clamp(across * (flow * clump * birth * 0.9 + l1Glow * 1.1 + hotspot), 0.0, 1.0);
    return vec4(col * (1.5 + 2.5 * t) * a, a);
  }

  vec3 marchRay(vec2 fragUv) {
    float rs = max(uRs, 0.01);
    vec4 farP = uInvViewProj * vec4(fragUv * 2.0 - 1.0, 1.0, 1.0);
    if (abs(farP.w) < 1e-6) return vec3(0.0);
    vec3 toFar = farP.xyz / farP.w - uCameraPos;
    if (dot(toFar, toFar) < 1e-12) return vec3(0.0);
    vec3 rayDir = normalize(toFar);
    vec3 pos = uCameraPos - uBhPos;
    // 직선 충돌 매개변수 — 광자구 임계(b<BCRIT·rs) 안이면 그림자(배경 안 샘).
    float impactB = length(cross(pos, rayDir));

    float startR = START_R * rs;
    float along = -dot(pos, rayDir);

    vec3 color = vec3(0.0);
    float alpha = 0.0;

    // 외곽 디스크 직선 패스 — 빈공간 스킵이 건너뛰는 근측 외곽 디스크(거의 안 휨)를 해석적으로
    // 먼저 합성한다. 마칭(START_R 안)은 강하게 휘는 안쪽·감김만 담당 → START_R을 낮춰 휨을
    // 디스크부터 시작해도 외곽 디스크가 안 잘린다. 근측(최근접 이전) + START_R 밖만 잡아 마칭과 비중복.
    if (uDiskEnabled > 0.5 && abs(rayDir.y) > 1e-5) {
      float tDisk = -pos.y / rayDir.y;
      if (tDisk > 0.0 && tDisk < along) {
        vec3 dh = pos + rayDir * tDisk;
        float dr3 = length(dh);
        float dr = length(vec2(dh.x, dh.z));
        if (dr3 > startR) {
          if (dr > uDiskInner && dr < uDiskOuter) {
            vec4 ds = diskSample(dr, atan(dh.z, dh.x), rayDir);
            color += ds.rgb * ds.w;
            alpha += ds.w;
          } else if (uStreamEnabled > 0.5 && dr >= uDiskOuter) {
            vec4 ss = streamSample(dr, atan(dh.z, dh.x));
            color += ss.rgb * ss.w;
            alpha += ss.w;
          }
        }
      }
    }

    if (along > 0.0 && length(pos) > startR) {
      float closest = length(pos + rayDir * along);
      pos += rayDir * max(along - sqrt(max(startR * startR - closest * closest, 0.0)), 0.0);
    }

    float stepLen = STEP * rs;
    float escapeR = ESCAPE_R * rs;
    float captureR = CAPTURE * rs;
    bool captured = false;
    bool escaped = false;
    vec3 prevPos = pos;

    for (int i = 0; i < ${STEPS}; i++) {
      if (float(i) >= uSteps) break; // 티어별 스텝 상한 (루프 경계는 상수 고정, 유니폼으로 조기 종료)
      float r = length(pos);
      if (r < captureR) { captured = true; break; }
      if (r > escapeR) { escaped = true; break; }
      if (alpha > 0.99) break;

      vec3 toCenter = -pos / r;
      vec3 newDir = rayDir + toCenter * ((rs / (r * r)) * stepLen * LENS_STRENGTH);
      float ndl = dot(newDir, newDir);
      rayDir = ndl > 1e-12 ? newDir * inversesqrt(ndl) : rayDir;
      prevPos = pos;
      pos += rayDir * stepLen;

      if (uDiskEnabled > 0.5 && prevPos.y * pos.y < 0.0 && alpha < 0.99) {
        float t = -prevPos.y / (pos.y - prevPos.y);
        vec3 hit = mix(prevPos, pos, clamp(t, 0.0, 1.0));
        float hr = length(vec2(hit.x, hit.z));
        if (hr > uDiskInner && hr < uDiskOuter) {
          vec4 ds = diskSample(hr, atan(hit.z, hit.x), rayDir);
          float rem = 1.0 - alpha;
          color += ds.rgb * ds.w * rem;
          alpha += rem * ds.w;
        } else if (uStreamEnabled > 0.5 && hr >= uDiskOuter) {
          vec4 ss = streamSample(hr, atan(hit.z, hit.x));
          float rem = 1.0 - alpha;
          color += ss.rgb * ss.w * rem;
          alpha += rem * ss.w;
        }
      }
    }

    // 배경은 *진짜 탈출한* 광선만 샘플 — 스텝 소진(미탈출)은 빨려든 셈이라 검정(그림자).
    // 광자구 안(b<BCRIT·rs)도 그림자(검정). 밖+탈출이면 휜 방향으로 실제 씬 샘플.
    if (escaped && alpha < 0.99 && impactB >= BCRIT * rs) {
      vec2 bgUv = dirToScreenUv(rayDir);
      if (bgUv.x >= 0.0 && bgUv.x <= 1.0 && bgUv.y >= 0.0 && bgUv.y <= 1.0) {
        float dRaw = readDepth(bgUv);
        float bhDist = length(uBhPos - uCameraPos);
        // mainImage의 전경 판정과 동일 기준(+2rs) — 통과(passthrough)된 별이 휜 배경에
        // 한 번 더 샘플되어 이중상이 생기는 것을 막는다.
        bool foreground = dRaw > 0.0001 && dRaw < 0.999 && -getViewZ(dRaw) < bhDist + uRs * 2.0;
        if (!foreground) color += texture2D(inputBuffer, bgUv).rgb * (1.0 - alpha);
      }
    }
    return color;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = inputColor;
    if (uActive < 0.5) return;

    vec2 dScreen = vec2((vUv.x - uCenter.x) * uAspect, vUv.y - uCenter.y);
    float screenDist = length(dScreen);
    if (screenDist > uScreenRadius) return;

    // 전경 오클루전 — 이 픽셀의 씬 조각이 "명확히 BH 뒤"가 아니면(앞·옆을 지나는 동반성 등)
    // 렌즈를 적용하지 않고 씬을 그대로 둔다. 구 기준(×0.85 상대 비율)은 BH와 비슷한 깊이로
    // 도는 동반성을 전경으로 인정하지 못해 렌즈 출력이 별을 반토막 냈다 (exotic-codex 쌍성 BH
    // 도입으로 드러난 버그). 절대 마진(+2rs)으로 바꿔 사건지평선 뒤 2rs 이상 멀어진 것만 렌징한다
    // — 옆/앞의 별은 깨끗이 통과, 뒤로 넘어간 별은 여전히 휘어 보인다.
    float depthRaw = readDepth(vUv);
    float bhDistance = length(uBhPos - uCameraPos);
    if (depthRaw > 0.0001 && depthRaw < 0.9999 && -getViewZ(depthRaw) < bhDistance + uRs * 2.0) return;

    // 슈퍼샘플링 — high만 2x2(자글거림 제거, 비용 4배). med·low는 단일 샘플(uSupersample=0).
    // MSAA는 포스트 패스에 안 먹으므로 필터 내부에서 직접 슈퍼샘플한다. (texelSize = 1/resolution)
    vec3 color;
    if (uSupersample > 0.5) {
      vec2 ss = texelSize * 0.25;
      color = (
        marchRay(vUv + vec2(-ss.x, -ss.y)) +
        marchRay(vUv + vec2( ss.x, -ss.y)) +
        marchRay(vUv + vec2(-ss.x,  ss.y)) +
        marchRay(vUv + vec2( ss.x,  ss.y))
      ) * 0.25;
    } else {
      color = marchRay(vUv);
    }

    float edgeFade = 1.0 - smoothstep(uScreenRadius * 0.70, uScreenRadius, screenDist);
    vec3 finalCol = mix(inputColor.rgb, color, edgeFade);
    if (any(notEqual(finalCol, finalCol)) || any(greaterThan(abs(finalCol), vec3(1e20)))) {
      outputColor = inputColor;
      return;
    }
    outputColor = vec4(clamp(finalCol, 0.0, 6.0), 1.0);
  }
`;

class BlackHoleRayMarchImpl extends Effect {
  constructor() {
    super("BlackHoleRayMarch", FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform<number | Vector2 | Vector3 | Matrix4>>([
        ["uActive", new Uniform(0)],
        ["uCameraPos", new Uniform(new Vector3())],
        ["uInvViewProj", new Uniform(new Matrix4())],
        ["uViewProj", new Uniform(new Matrix4())],
        ["uBhPos", new Uniform(new Vector3())],
        ["uRs", new Uniform(1)],
        ["uDiskInner", new Uniform(2.5)],
        ["uDiskOuter", new Uniform(9)],
        ["uDiskEnabled", new Uniform(0)],
        ["uStreamEnabled", new Uniform(0)],
        ["uStreamAngle", new Uniform(0)],
        ["uStreamStartR", new Uniform(20)],
        ["uDiskNormal", new Uniform(new Vector3(0, 1, 0))],
        ["uCenter", new Uniform(new Vector2(0.5, 0.5))],
        ["uScreenRadius", new Uniform(0.2)],
        ["uAspect", new Uniform(1)],
        ["uTime", new Uniform(0)],
        ["uSteps", new Uniform(140)],
        ["uSupersample", new Uniform(1)],
      ]),
    });
  }

  override update(
    _renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    deltaTime: number
  ): void {
    const u = this.uniforms as Map<
      string,
      Uniform<number | Vector2 | Vector3 | Matrix4>
    >;
    const set = (name: string, value: number): void => {
      const uniform = u.get(name);
      if (uniform != null) uniform.value = value;
    };
    const copy = (name: string, value: Vector2 | Vector3 | Matrix4): void => {
      const uniform = u.get(name);
      if (uniform != null)
        (uniform.value as { copy(v: typeof value): void }).copy(value);
    };
    set("uActive", blackHoleLens.active ? 1 : 0);
    copy("uCameraPos", blackHoleLens.cameraPos);
    copy("uInvViewProj", blackHoleLens.invViewProj);
    copy("uViewProj", blackHoleLens.viewProj);
    copy("uBhPos", blackHoleLens.bhPos);
    set("uRs", blackHoleLens.rs);
    set("uDiskInner", blackHoleLens.diskInner);
    set("uDiskOuter", blackHoleLens.diskOuter);
    set("uDiskEnabled", blackHoleLens.diskEnabled ? 1 : 0);
    set("uStreamEnabled", blackHoleLens.streamEnabled ? 1 : 0);
    set("uStreamAngle", blackHoleLens.streamAngle);
    set("uStreamStartR", blackHoleLens.streamStartR);
    copy("uDiskNormal", blackHoleLens.diskNormal);
    copy("uCenter", blackHoleLens.center);
    set("uScreenRadius", blackHoleLens.screenRadius);
    if (inputBuffer.height > 0)
      set("uAspect", inputBuffer.width / inputBuffer.height);
    const time = u.get("uTime");
    if (time != null) time.value = ((time.value as number) + deltaTime) % 10000;
    // 티어별 품질 — 모든 티어가 같은 가르강튀아 형태를 그리되 스텝/SS만 낮춘다.
    // 단, 자동 모드에서는 블랙홀을 항상 high로 고정한다(결정 5의 high 사치). 블랙홀은 본질적으로
    // 무거워 자동 하향을 거의 항상 자극하는데, 그 하향이 가르강튀아 룩을 떨어뜨리면 본전을 못 찾는다.
    // QualityAdapter가 블랙홀 근접 중 하향을 보류하므로(쌍을 이룸), 여기서 high로 고정해도 토스트
    // 반복·전체 씬 하락이 없다. 수동 오버라이드(낮음/중간)는 사용자 의도라 그대로 존중한다.
    const { qualityTier, qualityMode } = useGameStore.getState();
    const preset =
      qualityMode === "auto" ? QUALITY_PRESETS.high : QUALITY_PRESETS[qualityTier];
    set("uSteps", preset.blackHoleSteps);
    set("uSupersample", preset.blackHoleSupersample ? 1 : 0);
  }
}

export const BlackHoleRayMarch = wrapEffect(BlackHoleRayMarchImpl);
