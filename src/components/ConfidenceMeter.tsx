import React, { useEffect, useState } from 'react';

interface ConfidenceMeterProps {
	// Normalized confidence in the range [0.5, 1.0]
	value: number;
	size?: number; // desktop/tablet width in px
	sizeMobile?: number; // mobile width in px
	showTitle?: boolean; // show the "Confidence Meter" label above gauge
}

function clampToMeterRange(raw: number): number {
	if (Number.isNaN(raw) || !Number.isFinite(raw)) return 0.5;
	return Math.max(0.5, Math.min(1.0, raw));
}

function getConfidenceLabel(value: number): { label: 'Low' | 'Medium' | 'High'; color: string } {
	// Even thirds across [0.5, 1.0]
	const t1 = 0.5 + (0.5 / 3); // ≈ 0.6667
	const t2 = 0.5 + (2 * 0.5 / 3); // ≈ 0.8333
	if (value <= t1) return { label: 'Low', color: '#ef4444' }; // red-500
	if (value <= t2) return { label: 'Medium', color: '#f59e0b' }; // amber-500
	return { label: 'High', color: '#10b981' }; // emerald-500
}

// Convert a value in [0.5, 1.0] to an angle in degrees across a 180° arc
// -90° (far left) at 0.5, +90° (far right) at 1.0
function valueToAngleDeg(value: number): number {
	const normalized = (value - 0.5) / 0.5; // 0..1
	// Map to top-facing semi-circle: -180° (far left/top) to 0° (far right/top)
	return -180 + normalized * 180;
}

// Utility to build an SVG arc path between two angles (degrees)
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
	const startRad = (Math.PI / 180) * startDeg;
	const endRad = (Math.PI / 180) * endDeg;
	const x1 = cx + r * Math.cos(startRad);
	const y1 = cy + r * Math.sin(startRad);
	const x2 = cx + r * Math.cos(endRad);
	const y2 = cy + r * Math.sin(endRad);
	const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
	return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}


const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({ value, size = 110, sizeMobile = 90, showTitle = false }) => {
	const val = clampToMeterRange(value);
	const { label, color } = getConfidenceLabel(val);

	// Responsive width selection
	const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
	useEffect(() => {
		function onResize() {
			setIsMobile(window.innerWidth < 640);
		}
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const width = isMobile ? sizeMobile : size;

	// SVG geometry (consistent positioning for all meters)
	const radius = width / 2 - 8; // consistent padding
	const cx = width / 2;
	const cy = radius + 8; // consistent vertical center
	const height = cy + 20; // consistent height for label space

	const needleAngle = valueToAngleDeg(val);
	const needleRad = (Math.PI / 180) * needleAngle;
	const needleLen = radius * 0.9;
	const nx = cx + needleLen * Math.cos(needleRad);
	const ny = cy + needleLen * Math.sin(needleRad);

	// Segment boundaries in degrees (equal thirds for aesthetics)
	// Color wedges are equal-sized, while tick marks and needle still reflect true thresholds/value.
	const lowStart = -180;
	const lowEnd = -120;
	const medStart = -120;
	const medEnd = -60;
	const highStart = -60;
	const highEnd = 0;

	const vToDeg = (v: number) => valueToAngleDeg(clampToMeterRange(v));

	return (
		<div className="flex flex-col items-center justify-center">
			{showTitle && (
				<div className="text-[11px] sm:text-xs font-semibold text-gray-700 mb-1">Confidence Meter</div>
			)}
			<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
				{/* Background arc (light gray) */}
				<path d={arcPath(cx, cy, radius, -180, 0)} stroke="#e5e7eb" strokeWidth={10} fill="none" />

				{/* Low segment (red) */}
				<path d={arcPath(cx, cy, radius, lowStart, lowEnd)} stroke="#ef4444" strokeWidth={10} fill="none" />
				{/* Medium segment (amber) */}
				<path d={arcPath(cx, cy, radius, medStart, medEnd)} stroke="#f59e0b" strokeWidth={10} fill="none" />
				{/* High segment (green) */}
				<path d={arcPath(cx, cy, radius, highStart, highEnd)} stroke="#10b981" strokeWidth={10} fill="none" />

				{/* Tick marks at equal-third thresholds */}
				{[0.5 + (0.5 / 3), 0.5 + (2 * 0.5 / 3)].map((t, i) => {
					const deg = vToDeg(t);
					const r1 = radius * 0.76;
					const r2 = radius * 0.98;
					const rad = (Math.PI / 180) * deg;
					const x1 = cx + r1 * Math.cos(rad);
					const y1 = cy + r1 * Math.sin(rad);
					const x2 = cx + r2 * Math.cos(rad);
					const y2 = cy + r2 * Math.sin(rad);
					return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b7280" strokeWidth={1} />;
				})}

				{/* Needle pivot */}
				<circle cx={cx} cy={cy} r={4} fill="#374151" />
				{/* Needle */}
				<line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#111827" strokeWidth={2.5} />
				{/* Needle head */}
				<circle cx={nx} cy={ny} r={3} fill="#111827" />

				{/* Current label bubble under arc */}
				<text x={cx} y={height - 2} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>{label}</text>
			</svg>
		</div>
	);
};

export default ConfidenceMeter;


