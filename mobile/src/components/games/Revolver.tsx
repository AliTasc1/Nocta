import React, { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Rus Ruleti sahnesi: stilize, 2.5D bir altıpatlar tamburu (arkadan görünüm).
 *
 * Katmanlar (alttan üste):
 *  1. Çerçeve: masa gölgesi, ceviz kabza, tabanca gövdesi (recoil shield), vidalar, horoz kanalı
 *  2. Horoz (tetik çekilince kalkar — `cock` 0→1)
 *  3. Tambur (döner — `rot` derece): fırçalanmış metal, oluklu kenar, 6 yuva, yıldız ejektör, merkez pim
 *  4. Hareket bulanıklığı (tamburla döner — `blur` 0→1)
 *  5. Yuvadaki mermi dibi (tamburla döner — `headIn` 0→1)
 *  6. Sabit parlama/gölge (tambur dönerken ışık sabit kalır)
 *  7. Yüklenen mermi (yan görünüm, kayarak yuvaya girer — `insert` 0→1)
 *  8. Duman (`smoke` 0→1)
 *
 * Sahne koordinatları: 300 × 330 birim, tambur merkezi (150, 190), yarıçap 108.
 * Yuva k, tamburun yerel açısı −60k° konumundadır; `rot` = 60 × chamber iken sıradaki yuva en üsttedir.
 */
export const STAGE_W = 300;
export const STAGE_H = 330;
const CX = 150;
const CY = 190;
const R = 108;
const CH_R = 64; // yuvaların merkeze uzaklığı
const HOLE = 23;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}
const f = (n: number) => Math.round(n * 100) / 100;

/** Olukları olan (kenarında 6 içbükey çentik) tambur silueti — tambur katmanının 300×300 koordinatlarında */
function cylinderOutline(cx: number, cy: number) {
  const d = 112; // çentik çemberinin merkeze uzaklığı
  const rn = 12; // çentik yarıçapı
  const phi = (Math.acos((R * R + d * d - rn * rn) / (2 * R * d)) * 180) / Math.PI;
  let p = '';
  for (let k = 0; k < 6; k++) {
    const t = 30 + 60 * k;
    const [x1, y1] = polar(cx, cy, R, t - phi);
    const [x2, y2] = polar(cx, cy, R, t + phi);
    const [nx, ny] = polar(cx, cy, R, t + 60 - phi);
    p += k === 0 ? `M${f(x1)} ${f(y1)}` : '';
    p += `A${rn} ${rn} 0 0 0 ${f(x2)} ${f(y2)}`;
    p += `A${R} ${R} 0 0 1 ${f(nx)} ${f(ny)}`;
  }
  return p + 'Z';
}
const OUTLINE = cylinderOutline(150, 150);

function starPath(cx: number, cy: number, ro: number, ri: number, n: number, rot = 0) {
  let p = '';
  for (let i = 0; i < n * 2; i++) {
    const [x, y] = polar(cx, cy, i % 2 ? ri : ro, rot + (i * 180) / n);
    p += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`;
  }
  return p + 'Z';
}
const STAR = starPath(150, 150, 33, 24, 6, 30);

// ─────────────────────────────────────────────────────────────
// Statik katmanlar
// ─────────────────────────────────────────────────────────────
const Frame = memo(function Frame({ size }: { size: number }) {
  const h = (size * STAGE_H) / STAGE_W;
  return (
    <Svg width={size} height={h} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
      <Defs>
        <RadialGradient id="rv-shadow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#000" stopOpacity="0.7" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="rv-frame" x1="40" y1="30" x2="260" y2="320" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#5B6068" />
          <Stop offset="0.35" stopColor="#30333A" />
          <Stop offset="0.75" stopColor="#1B1D22" />
          <Stop offset="1" stopColor="#0F1013" />
        </LinearGradient>
        <LinearGradient id="rv-frameEdge" x1="60" y1="40" x2="240" y2="330" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A7ADB6" />
          <Stop offset="0.5" stopColor="#3C4047" />
          <Stop offset="1" stopColor="#0A0B0D" />
        </LinearGradient>
        <LinearGradient id="rv-grip" x1="110" y1="270" x2="190" y2="330" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#7A4424" />
          <Stop offset="0.5" stopColor="#4A2612" />
          <Stop offset="1" stopColor="#1E0E06" />
        </LinearGradient>
        <LinearGradient id="rv-gripFade" x1="0" y1="280" x2="0" y2="330" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </LinearGradient>
        <RadialGradient id="rv-screw" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#C9CED6" />
          <Stop offset="0.6" stopColor="#5F646C" />
          <Stop offset="1" stopColor="#23252A" />
        </RadialGradient>
        <RadialGradient id="rv-gap" cx="150" cy="190" r="114" gradientUnits="userSpaceOnUse">
          <Stop offset="0.9" stopColor="#050506" />
          <Stop offset="1" stopColor="#15161A" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={150} cy={318} rx={140} ry={18} fill="url(#rv-shadow)" />
      {/* ceviz kabza (alttan görünür) */}
      <Path d="M104 262 L196 262 L188 330 L112 330 Z" fill="url(#rv-grip)" />
      <G opacity={0.22}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Line key={`a${i}`} x1={100 + i * 9} y1={268} x2={118 + i * 9} y2={330} stroke="#000" strokeWidth={0.8} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <Line key={`b${i}`} x1={118 + i * 9} y1={268} x2={100 + i * 9} y2={330} stroke="#000" strokeWidth={0.8} />
        ))}
      </G>
      <Path d="M104 262 L196 262 L188 330 L112 330 Z" fill="url(#rv-gripFade)" />
      {/* gövde: kenar parlaması (alt katman) + gövde */}
      <Circle cx={CX} cy={CY} r={130} fill="url(#rv-frameEdge)" />
      <Rect x={112} y={30} width={76} height={80} rx={15} fill="url(#rv-frameEdge)" />
      <Circle cx={CX} cy={CY} r={128.5} fill="url(#rv-frame)" />
      <Rect x={113.5} y={31.5} width={73} height={80} rx={13.5} fill="url(#rv-frame)" />
      {/* üst kayış çizgisi ve horoz kanalı */}
      <Rect x={137} y={34} width={26} height={44} rx={6} fill="#08090B" />
      <Rect x={137} y={34} width={26} height={44} rx={6} fill="none" stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={1} />
      {/* vidalar */}
      {[
        [66, 112],
        [234, 112],
        [150, 300],
      ].map(([x, y], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={6.5} fill="#0B0C0E" />
          <Circle cx={x} cy={y} r={5.5} fill="url(#rv-screw)" />
          <Line x1={x - 3.8} y1={y + 1.2} x2={x + 3.8} y2={y - 1.2} stroke="#1A1B1F" strokeWidth={1.3} strokeLinecap="round" />
        </G>
      ))}
      {/* tambur ile gövde arasındaki boşluk */}
      <Circle cx={CX} cy={CY} r={114} fill="url(#rv-gap)" />
      {/* nişan işareti: ateşleme yuvası (üst) */}
      <Path d={`M${CX - 6} ${CY - R - 12} L${CX + 6} ${CY - R - 12} L${CX} ${CY - R - 5} Z`} fill="#F2C27B" opacity={0.85} />
    </Svg>
  );
});

/** Tambur (dönen katman). `spent`: boş çıkan yuvalar · `bang`: patlayan yuva */
const CylinderFace = memo(function CylinderFace({ size, spent, bang }: { size: number; spent: number[]; bang: number | null }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      <Defs>
        <RadialGradient id="cy-body" cx="150" cy="150" r="108" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#4A4E56" />
          <Stop offset="0.55" stopColor="#3A3D44" />
          <Stop offset="0.9" stopColor="#2A2C32" />
          <Stop offset="1" stopColor="#16171B" />
        </RadialGradient>
        <RadialGradient id="cy-chamfer" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0.78" stopColor="#0C0D10" />
          <Stop offset="0.9" stopColor="#3B3F46" />
          <Stop offset="1" stopColor="#8C929B" />
        </RadialGradient>
        <RadialGradient id="cy-hole" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#000000" />
          <Stop offset="0.65" stopColor="#060607" />
          <Stop offset="1" stopColor="#1D1F24" />
        </RadialGradient>
        <RadialGradient id="cy-soot" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0.55" stopColor="#3A1E12" stopOpacity="0" />
          <Stop offset="0.85" stopColor="#6B3A20" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#2A140A" stopOpacity="0.2" />
        </RadialGradient>
        <RadialGradient id="cy-bang" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FF6A3D" stopOpacity="0.55" />
          <Stop offset="0.6" stopColor="#B0102A" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#B0102A" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="cy-star" cx="150" cy="150" r="34" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#8E949D" />
          <Stop offset="0.7" stopColor="#50545C" />
          <Stop offset="1" stopColor="#2A2C31" />
        </RadialGradient>
        <RadialGradient id="cy-pin" cx="0.38" cy="0.32" r="0.75">
          <Stop offset="0" stopColor="#F1F3F6" />
          <Stop offset="0.45" stopColor="#A2A8B1" />
          <Stop offset="1" stopColor="#3C4047" />
        </RadialGradient>
      </Defs>
      <Path d={OUTLINE} fill="url(#cy-body)" />
      {/* fırçalanmış metal: eş merkezli ince halkalar */}
      {Array.from({ length: 16 }).map((_, i) => (
        <Circle key={i} cx={150} cy={150} r={38 + i * 4.3} fill="none" stroke={i % 2 ? '#000000' : '#FFFFFF'} strokeOpacity={i % 2 ? 0.07 : 0.035} strokeWidth={1.4} />
      ))}
      <Path d={OUTLINE} fill="none" stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1.2} />
      <Path d={OUTLINE} fill="none" stroke="#050506" strokeWidth={0.8} />
      {/* yuvalar */}
      {Array.from({ length: 6 }).map((_, k) => {
        const [x, y] = polar(150, 150, CH_R, -60 * k);
        const isSpent = spent.includes(k);
        const isBang = bang === k;
        return (
          <G key={k}>
            <Circle cx={x} cy={y} r={HOLE + 5} fill="url(#cy-chamfer)" />
            <Circle cx={x} cy={y} r={HOLE} fill="url(#cy-hole)" />
            <Circle cx={x} cy={y} r={HOLE + 5} fill="none" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={0.8} />
            {isSpent ? (
              <G>
                <Circle cx={x} cy={y} r={HOLE + 1} fill="url(#cy-soot)" />
                <Circle cx={x} cy={y} r={3} fill="#F2C27B" fillOpacity={0.35} />
              </G>
            ) : null}
            {isBang ? <Circle cx={x} cy={y} r={HOLE + 6} fill="url(#cy-bang)" /> : null}
          </G>
        );
      })}
      {/* yıldız ejektör + merkez pim */}
      <Path d={STAR} fill="#16171B" transform="translate(0 1.5)" />
      <Path d={STAR} fill="url(#cy-star)" />
      <Path d={STAR} fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={0.8} />
      <Circle cx={150} cy={150} r={12} fill="#101114" />
      <Circle cx={150} cy={150} r={10.5} fill="url(#cy-pin)" />
      <Circle cx={150} cy={150} r={3} fill="#1A1B1F" />
    </Svg>
  );
});

/** Sabit ışık: tambur dönerken parlama ve gölge yerinde kalır */
const Specular = memo(function Specular({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      <Defs>
        <LinearGradient id="sp-shade" x1="70" y1="60" x2="235" y2="250" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#000" stopOpacity="0" />
          <Stop offset="0.55" stopColor="#000" stopOpacity="0.05" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </LinearGradient>
        <RadialGradient id="sp-hi" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFF4E6" stopOpacity="0.32" />
          <Stop offset="0.5" stopColor="#FFF4E6" stopOpacity="0.1" />
          <Stop offset="1" stopColor="#FFF4E6" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="sp-band" x1="50" y1="125" x2="185" y2="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFF4E6" stopOpacity="0" />
          <Stop offset="0.45" stopColor="#FFF4E6" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#FFF4E6" stopOpacity="0.02" />
        </LinearGradient>
        <LinearGradient id="sp-rim" x1="60" y1="60" x2="200" y2="140" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFE9CF" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#FFE9CF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Circle cx={150} cy={150} r={107} fill="url(#sp-shade)" />
      {/* parlama yalnızca metal halkada ve merkezde: yuvalar karanlık kalır (dolu sanılmasın) */}
      <Path d="M54.9 119.1 A 100 100 0 0 1 180.9 54.9" fill="none" stroke="url(#sp-band)" strokeWidth={13} strokeLinecap="round" />
      <Circle cx={141} cy={141} r={26} fill="url(#sp-hi)" />
      {/* sol üst kenar ışığı */}
      <Path d="M54.8 105.6 A 105 105 0 0 1 168.2 46.6" fill="none" stroke="url(#sp-rim)" strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M86 212 A 92 92 0 0 0 150 242" fill="none" stroke="#FFD9B0" strokeOpacity={0.08} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
});

/** Dönme bulanıklığı: yuvalar hızla dönerken tek bir koyu halkaya karışır */
const BlurRing = memo(function BlurRing({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      <Circle cx={150} cy={150} r={CH_R} fill="none" stroke="#0B0C0E" strokeOpacity={0.8} strokeWidth={50} />
      <Circle cx={150} cy={150} r={CH_R + 26} fill="none" stroke="#9097A1" strokeOpacity={0.18} strokeWidth={2} />
      <Circle cx={150} cy={150} r={CH_R - 26} fill="none" stroke="#9097A1" strokeOpacity={0.14} strokeWidth={2} />
      {Array.from({ length: 5 }).map((_, i) => (
        <Path
          key={i}
          d={`M${f(polar(150, 150, 100 - i * 3, i * 72)[0])} ${f(polar(150, 150, 100 - i * 3, i * 72)[1])} A ${100 - i * 3} ${100 - i * 3} 0 0 1 ${f(polar(150, 150, 100 - i * 3, i * 72 + 40)[0])} ${f(polar(150, 150, 100 - i * 3, i * 72 + 40)[1])}`}
          fill="none"
          stroke="#E6EAF0"
          strokeOpacity={0.12}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
});

/** Yuvadaki mermi dibi (pirinç kovan + kapsül) — üst yuvada */
const BulletHead = memo(function BulletHead({ size }: { size: number }) {
  const [x, y] = polar(150, 150, CH_R, 0);
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      <Defs>
        <RadialGradient id="bh-brass" cx="0.38" cy="0.32" r="0.8">
          <Stop offset="0" stopColor="#FFF0C2" />
          <Stop offset="0.35" stopColor="#E0AE4E" />
          <Stop offset="0.8" stopColor="#8A5E1A" />
          <Stop offset="1" stopColor="#4E330C" />
        </RadialGradient>
        <RadialGradient id="bh-primer" cx="0.4" cy="0.35" r="0.8">
          <Stop offset="0" stopColor="#F4F1EA" />
          <Stop offset="0.6" stopColor="#B7B0A3" />
          <Stop offset="1" stopColor="#6C665C" />
        </RadialGradient>
      </Defs>
      <Circle cx={x} cy={y} r={HOLE - 0.5} fill="url(#bh-brass)" />
      <Circle cx={x} cy={y} r={HOLE - 3.5} fill="none" stroke="#5A3D0F" strokeOpacity={0.7} strokeWidth={1.2} />
      <Circle cx={x} cy={y} r={7.5} fill="#5A3D0F" />
      <Circle cx={x} cy={y} r={6.5} fill="url(#bh-primer)" />
      <Circle cx={x} cy={y} r={HOLE - 0.5} fill="none" stroke="#FFF6DC" strokeOpacity={0.35} strokeWidth={0.8} />
    </Svg>
  );
});

/** Yan görünüm fişek (yükleme animasyonu ve bekleme durumunda) */
export const Cartridge = memo(function Cartridge({ width }: { width: number }) {
  const h = width * 3.1;
  return (
    <Svg width={width} height={h} viewBox="0 0 20 62">
      <Defs>
        <LinearGradient id="ct-brass" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6E4A12" />
          <Stop offset="0.28" stopColor="#F8DC92" />
          <Stop offset="0.5" stopColor="#D9A543" />
          <Stop offset="1" stopColor="#5A3C0E" />
        </LinearGradient>
        <LinearGradient id="ct-lead" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6B3B22" />
          <Stop offset="0.3" stopColor="#E7A177" />
          <Stop offset="0.55" stopColor="#B8673F" />
          <Stop offset="1" stopColor="#4A2412" />
        </LinearGradient>
      </Defs>
      <Path d="M4 22 C4 12 7 3 10 1 C13 3 16 12 16 22 Z" fill="url(#ct-lead)" />
      <Rect x={3} y={21} width={14} height={36} rx={1.2} fill="url(#ct-brass)" />
      <Rect x={2} y={56} width={16} height={4.5} rx={1} fill="url(#ct-brass)" />
      <Rect x={3} y={53.2} width={14} height={1.2} fill="#5A3C0E" opacity={0.6} />
    </Svg>
  );
});

const Hammer = memo(function Hammer({ size }: { size: number }) {
  const k = size / STAGE_W;
  return (
    <Svg width={70 * k} height={90 * k} viewBox="115 0 70 90">
      <Defs>
        <LinearGradient id="hm-steel" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#23252A" />
          <Stop offset="0.35" stopColor="#A9AFB8" />
          <Stop offset="0.55" stopColor="#6A7079" />
          <Stop offset="1" stopColor="#1C1E22" />
        </LinearGradient>
      </Defs>
      <Rect x={141} y={26} width={18} height={50} rx={4} fill="url(#hm-steel)" />
      <Path d="M133 30 Q133 12 150 10 Q167 12 167 30 Q160 34 150 34 Q140 34 133 30 Z" fill="url(#hm-steel)" />
      {[15, 19, 23, 27].map((y) => (
        <Line key={y} x1={137} y1={y} x2={163} y2={y} stroke="#0C0D10" strokeOpacity={0.55} strokeWidth={1.1} />
      ))}
      <Path d="M136 29 Q136 14 150 12" fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1} />
    </Svg>
  );
});

/** Duman bulutu (tek puf) */
const Puff = memo(function Puff({ d }: { d: number }) {
  return (
    <Svg width={d} height={d} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="pf" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#E4DEDB" stopOpacity="0.75" />
          <Stop offset="0.6" stopColor="#A29B98" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#9B9491" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill="url(#pf)" />
    </Svg>
  );
});

const PUFFS = [
  { dx: -6, dy: -70, s: 1.6, d: 0 },
  { dx: 14, dy: -95, s: 2.1, d: 0.08 },
  { dx: -18, dy: -120, s: 2.6, d: 0.16 },
  { dx: 8, dy: -150, s: 3.1, d: 0.24 },
  { dx: -4, dy: -175, s: 3.5, d: 0.32 },
];

export type RevolverAnims = {
  rot: Animated.Value;
  cock: Animated.Value;
  blur: Animated.Value;
  headIn: Animated.Value;
  insert: Animated.Value;
  smoke: Animated.Value;
  /** −1…1 geri tepme */
  recoil: Animated.Value;
  /** bekleme durumunda fişeğin süzülmesi */
  bob: Animated.Value;
};

export function Revolver({ size, a, spent, bang, showCartridge }: { size: number; a: RevolverAnims; spent: number[]; bang: number | null; showCartridge: boolean }) {
  const k = size / STAGE_W;
  const h = STAGE_H * k;
  const rotate = a.rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const cylStyle = { position: 'absolute' as const, left: 0, top: (CY - 150) * k, width: size, height: size, transform: [{ rotate }] };
  const [tx, ty] = polar(CX, CY, CH_R, 0);
  const cw = 20 * k * 1.05;
  const chh = cw * 3.1;
  // Fişek: sağ üstten eğik gelir, üst yuvaya kayarak girer ve küçülür
  const insertX = a.insert.interpolate({ inputRange: [0, 1], outputRange: [(236 - tx) * k, 0] });
  const insertY = a.insert.interpolate({ inputRange: [0, 1], outputRange: [(54 - ty) * k, 0] });
  const insertRot = a.insert.interpolate({ inputRange: [0, 0.7, 1], outputRange: ['32deg', '8deg', '0deg'] });
  const insertScale = a.insert.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.8, 0.45] });
  const insertOpacity = a.insert.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
  const bobY = a.bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5 * k] });

  return (
    <Animated.View
      style={{
        width: size,
        height: h,
        transform: [
          { translateY: a.recoil.interpolate({ inputRange: [-1, 0, 1], outputRange: [6 * k, 0, -10 * k] }) },
          { rotate: a.recoil.interpolate({ inputRange: [-1, 0, 1], outputRange: ['0.6deg', '0deg', '-2.2deg'] }) },
        ],
      }}
    >
      <View style={StyleSheet.absoluteFill}>
        <Frame size={size} />
      </View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 115 * k,
          top: 0,
          transform: [{ translateY: a.cock.interpolate({ inputRange: [0, 1], outputRange: [0, -13 * k] }) }, { scaleY: a.cock.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        }}
      >
        <Hammer size={size} />
      </Animated.View>
      <Animated.View style={cylStyle}>
        <CylinderFace size={size} spent={spent} bang={bang} />
      </Animated.View>
      <Animated.View style={[cylStyle, { opacity: a.headIn }, { pointerEvents: 'none' }]}>
        <BulletHead size={size} />
      </Animated.View>
      <Animated.View style={[cylStyle, { opacity: a.blur }, { pointerEvents: 'none' }]}>
        <BlurRing size={size} />
      </Animated.View>
      <View style={{ position: 'absolute', left: 0, top: (CY - 150) * k, width: size, height: size, pointerEvents: 'none' }}>
        <Specular size={size} />
      </View>
      {showCartridge ? (
        <Animated.View
          style={{
            position: 'absolute',
            left: tx * k - cw / 2,
            top: ty * k - chh + cw * 0.9,
            opacity: insertOpacity,
            transform: [{ translateX: insertX }, { translateY: insertY }, { translateY: bobY }, { rotate: insertRot }, { scale: insertScale }],
            pointerEvents: 'none',
          }}
        >
          <Cartridge width={cw} />
        </Animated.View>
      ) : null}
      {PUFFS.map((p, i) => {
        const t = a.smoke.interpolate({ inputRange: [0, p.d, Math.min(1, p.d + 0.5), 1], outputRange: [0, 0, 1, 1.2], extrapolate: 'clamp' });
        const o = a.smoke.interpolate({ inputRange: [0, p.d, p.d + 0.08, 1], outputRange: [0, 0, 0.9, 0], extrapolate: 'clamp' });
        const d = 44 * k;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: tx * k - d / 2,
              top: ty * k - d / 2,
              width: d,
              height: d,
              opacity: o,
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1.2], outputRange: [0, p.dx * k * 1.2] }) },
                { translateY: t.interpolate({ inputRange: [0, 1.2], outputRange: [0, p.dy * k * 1.2] }) },
                { scale: t.interpolate({ inputRange: [0, 1.2], outputRange: [0.5, p.s] }) },
              ],
              pointerEvents: 'none',
            }}
          >
            <Puff d={d} />
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}
