
// Sethares / Plomp–Levelt sensory dissonance kernel
// f1, f2 in Hz
// returns a non-negative roughness contribution (dimensionless)
export function setharesKernel(f1, f2) {
    const df = Math.abs(f1 - f2);
    if (df === 0) return 0;

    const minF = Math.min(f1, f2);

    // Equivalent Rectangular Bandwidth (ERB) approximation
    const erb = 24.7 * (4.37e-3 * minF + 1);

    const x = df / erb;

    // empirically derived constant for scaling the curve (plomp and levelt)
    const a = 3.51;
    const b = 5.75;
    return Math.exp(-a * x) - Math.exp(-b * x);
}


// Compute Sethares sensory dissonance between all pairs of peaks in the input array
export function setharesDissonance(peaks) {
    let dissonanceSum = 0;

    for (let i = 0; i < peaks.length; i++) {
        if (peaks[i].a === 0) continue;
        for (let j = i + 1; j < peaks.length; j++) {
            if (peaks[j].a === 0) continue;

            dissonanceSum += Math.min(peaks[i].a, peaks[j].a) * setharesKernel(peaks[i].f, peaks[j].f);
        }
    }
    return dissonanceSum;
}


// Build a Sethares dissonance curve by comparing a peak set to a shifted copy
export function buildDissonanceCurve(peaks1, peaks2) {
    const centsMin = 0;
    const centsMax = 1200;
    const centsStep = 1; // smaller step = smoother curve but more compute

    if (!peaks1 || peaks1.length < 1 || !peaks2 || peaks2.length < 1) {
        return { cents: [], values: [], rawMin: 0, rawMax: 0 };
    }

    // 1) Clean peaks: filter out invalid entries, sort by amplitude
    const cleaned1 = peaks1
        .filter(p => p && isFinite(p.f) && isFinite(p.a) && p.f > 0 && p.a > 0)
        .sort((p1, p2) => p2.a - p1.a)

    const cleaned2 = peaks2
        .filter(p => p && isFinite(p.f) && isFinite(p.a) && p.f > 0 && p.a > 0)
        .sort((p1, p2) => p2.a - p1.a)

    if (cleaned1.length < 1 || cleaned2.length < 1) {
        window.dissonanceCurve = { cents: [], values: [], rawMin: 0, rawMax: 0 };
    }

    // 2) Normalize amplitudes
    let aMax1 = 0;
    for (const p of cleaned1) aMax1 = Math.max(aMax1, p.a);
    if (aMax1 <= 0) aMax1 = 1;

    let aMax2 = 0;
    for (const p of cleaned2) aMax2 = Math.max(aMax2, p.a);
    if (aMax2 <= 0) aMax2 = 1;

    const base1 = cleaned1.map(p => ({ f: p.f, a: p.a / aMax1 }));
    const base2 = cleaned2.map(p => ({ f: p.f, a: p.a / aMax2 }));


    // --- 3) Sweep cents and compute dissonance vs shifted copy ---
    const cents = [];
    const values = [];

    let rawMin = Infinity;
    let rawMax = -Infinity;

    for (let c = centsMin; c <= centsMax + 1e-9; c += centsStep) {
        const ratio = Math.pow(2, c / 1200);

        // Shift copy (frequency scaled, amplitudes unchanged)
        const shifted = base2.map(p => ({ f: p.f * ratio, a: p.a }));
        const combined = [...base1, ...shifted];

        const D = setharesDissonance(combined);

        cents.push(c);
        values.push(D);

        if (D < rawMin) rawMin = D;
        if (D > rawMax) rawMax = D;
    }

    // Normalize curve to [0,1] 
    if (isFinite(rawMin) && isFinite(rawMax) && rawMax > rawMin) {
        const inv = 1 / (rawMax - rawMin);
        for (let i = 0; i < values.length; i++) {
            values[i] = (values[i] - rawMin) * inv;
        }
    } else {
        // flat curve
        for (let i = 0; i < values.length; i++) values[i] = 0;
        rawMin = rawMax = 0;
    }

    window.dissonanceCurve = { cents, values, rawMin, rawMax };
}


