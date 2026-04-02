import {draw} from './viz.js';
import {buildDissonanceCurve} from './sethares.js';
import {computeDissonance, stopPlayback, startPlayback, drawTimeline} from './dissonance-meter.js';


// ===== Shared recompute helpers =====

function dissonanceCurveRecompute(){
const peaks1 = window.buses.context?.peaks;
const peaks2 = window.buses.complement?.peaks;

buildDissonanceCurve(peaks1, peaks2);
}

function scheduleBusRecompute(track) {

    clearTimeout(track._busRecomputeDebounce);
    track._busRecomputeDebounce = setTimeout(async () => {
        if (track._currentBus) {
            await track._currentBus.computeStaticSpectrum();
            dissonanceCurveRecompute();
            await computeDissonance();
        }
    }, 0);
}

let dissonanceMeterTimeout = null;

function scheduleDissonanceMeter() {
    clearTimeout(dissonanceMeterTimeout);
    dissonanceMeterTimeout = setTimeout(async () => {
        await computeDissonance();
    }, 150);
}

// ===== Track UI =====

function wireTrackUI(track) {
    const id = track.id;

    const groupSelect = document.getElementById("show" + id);
    const fileInput = document.getElementById("fileInput" + id);
    const pitchSlider = document.getElementById("filePitch" + id);
    const pitchValueLabel = document.getElementById("filePitchVal" + id);
    const volSlider = document.getElementById("vol" + id);
    const volValueLabel = document.getElementById("volVal" + id);
    const cropStartSlider = document.getElementById("cropStart" + id);
    const cropEndSlider = document.getElementById("cropEnd" + id);
    const cropStartVal = document.getElementById("cropStartVal" + id);
    const cropEndVal = document.getElementById("cropEndVal" + id);
    const previewBtn = document.getElementById("previewBtn" + id);

    // Group select
    groupSelect.addEventListener("change", () => {
        track.setGroup(groupSelect.value);
        updateBottomRowColor();
        scheduleBusRecompute(track);
    });

    // File input
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0]
        if (!file) return;
        await track.initialiseFile(file)
        refreshCropLabels()
        scheduleBusRecompute(track);
    });


    // Pitch slider
    pitchSlider.addEventListener("input", () => {
        track.pitchRate = parseFloat(pitchSlider.value);
        pitchValueLabel.textContent = track.pitchRate.toFixed(2);
        scheduleBusRecompute(track);
    });


    // Volume slider
    volSlider.addEventListener("input", () => {
        const v = parseFloat(volSlider.value);
        volValueLabel.textContent = v.toFixed(2);
        track.gain.gain.setValueAtTime(v, window.audioCtx.currentTime);
        scheduleBusRecompute(track);
    });


    // Crop start
    cropStartSlider.addEventListener("input", () => {
        let v = parseFloat(cropStartSlider.value);
        if (v >= track.cropEnd) v = track.cropEnd - 0.01;
        track.cropStart = Math.max(0, v);
        cropStartSlider.value = track.cropStart; // slider snaps back if past end
        refreshCropLabels();
        scheduleBusRecompute(track);
    });

    // Crop end
    cropEndSlider.addEventListener("input", () => {
        let v = parseFloat(cropEndSlider.value);
        if (v <= track.cropStart) v = track.cropStart + 0.01;
        track.cropEnd = Math.min(1, v);
        cropEndSlider.value = track.cropEnd; //slider snaps back if past end
        refreshCropLabels();
        scheduleBusRecompute(track);
    });

    // Preview button
    previewBtn.addEventListener("click", () => {
        if (track._previewSrc) previewStop();
        else previewPlay();
    });


    // Track UI helper functions
    function fractionToSeconds(frac) {
        if (!track.fileBuffer) return `${Number(frac).toFixed(2)} s`;
        return `${(frac * track.fileBuffer.duration).toFixed(2)} s`;
    }

    function refreshCropLabels() {
        cropStartVal.textContent = fractionToSeconds(track.cropStart);
        cropEndVal.textContent = fractionToSeconds(track.cropEnd);
    }


    function updateBottomRowColor() {
        const row = previewBtn?.closest('.trackBottomRow');
        if (!row) return;
        if (track.group === 'complement') row.style.background = '#5e8ec3';
        else if (track.group === 'context') row.style.background = '#bb5858';
        else row.style.background = '#eeeeee';
    }


    function previewPlay() {
        if (!track.fileBuffer) return;
        previewStop();
        const src = window.audioCtx.createBufferSource();
        src.buffer = track.fileBuffer;
        src.playbackRate.value = track.pitchRate;
        const {offset, duration} = track.getCropSeconds();
        src.connect(track.gain);
        src.start(0, offset, duration);
        track._previewSrc = src;
        previewBtn.textContent = '⏹ Stop';
        previewBtn.classList.add('previewing');
        src.onended = () => {
            track._previewSrc = null;
            if (previewBtn) {
                previewBtn.textContent = '▶ Preview';
                previewBtn.classList.remove('previewing');
            }
        };
    }

    function previewStop() {
        if (track._previewSrc) {
            track._previewSrc.stop();
            track._previewSrc = null;
        }
        previewBtn.textContent = '▶ Preview';
        previewBtn.classList.remove('previewing');
    }

    refreshCropLabels();
}

// ===== Peak Picker UI =====

function wirePeakPickerUI() {
    const threshEl = document.getElementById("threshFrac");
    const threshVal = document.getElementById("threshFracVal");
    threshEl.addEventListener("input", () => {
        window.threshFrac = Number(threshEl.value);
        threshVal.textContent = window.threshFrac.toFixed(2);
        dissonanceCurveRecompute();
        scheduleDissonanceMeter();
    });

    const maxPeaksEl = document.getElementById("maxPeaksPicked");
    const maxPeaksVal = document.getElementById("maxPeaksVal");
    maxPeaksEl.addEventListener("input", () => {
        window.maxPeaksPicked = Number(maxPeaksEl.value);
        maxPeaksVal.textContent = String(window.maxPeaksPicked);
        dissonanceCurveRecompute();
        scheduleDissonanceMeter();
    });

    const minSepEl = document.getElementById("minSepHz");
    const minSepVal = document.getElementById("minSepHzVal");
    minSepEl.addEventListener("input", () => {
        window.minSepHz = Number(minSepEl.value);
        minSepVal.textContent = String(window.minSepHz);
        dissonanceCurveRecompute();
        scheduleDissonanceMeter();
    });

    const peakFMinEl = document.getElementById("peakFMin");
    const peakFMinVal = document.getElementById("peakFMinVal");
    peakFMinEl.addEventListener("input", () => {
        window.peakFMin = Number(peakFMinEl.value);
        peakFMinVal.textContent = String(window.peakFMin);
        dissonanceCurveRecompute();
        scheduleDissonanceMeter();
    });
}

// ===== Spectrum UI (xZoom) =====

function wireSpectrumUI() {
    document.getElementById("xZoom").addEventListener("input", e => {
        window.xZoom = parseFloat(e.target.value);
    });
}

// ===== Dissonance Curve UI =====

function wireDissonanceCurveUI() {
    const audSlider = document.getElementById("auditionCents");
    const audVal = document.getElementById("auditionCentsVal");

    audSlider.addEventListener("input", () => {
        window.auditionCents = Number(audSlider.value);
        audVal.textContent = String(window.auditionCents);
        scheduleDissonanceMeter();
    });

    let activeAuditionSources = [];

    function auditionStop() {
        activeAuditionSources.forEach(src => {
            try {
                src.onended = null;
            } catch (e) {
            }
            try {
                src.stop();
            } catch (e) {
            }
        });
        activeAuditionSources = [];
        stopPlayback();

        const btn = document.getElementById("auditionPlay");
            btn.textContent = "▶ Play interval";
            btn.classList.remove("previewing");
    }

    function auditionPlay() {
        const btn = document.getElementById("auditionPlay");

            auditionStop();
            const when = window.audioCtx.currentTime;
            const cents = window.auditionCents;
            const ratio = Math.pow(2, cents / 1200);

            startPlayback();

            if (window.buses.context) {
                const contextSrcs = window.buses.context.playAudition(1.0, when);
                activeAuditionSources.push(...contextSrcs);
            }
            if (window.buses.complement) {
                const complementSrcs = window.buses.complement.playAudition(ratio, when);
                activeAuditionSources.push(...complementSrcs);
            }

            if (btn) {
                btn.textContent = "⏹ Stop interval";
                btn.classList.add("previewing");
            }

            let remaining = activeAuditionSources.length;
            if (remaining === 0) {
                auditionStop();
                return;
            }

            activeAuditionSources.forEach(src => {
                src.onended = () => {
                    remaining--;
                    if (remaining <= 0) {
                        activeAuditionSources = [];
                        if (btn) {
                            btn.textContent = "▶ Play interval";
                            btn.classList.remove("previewing");
                        }
                    }
                };
            });

    }

    document.getElementById("auditionPlay").addEventListener("click", () => {
        if (activeAuditionSources.length > 0) auditionStop();
        else auditionPlay();
    });
}

// ===== Dissonance Meter UI =====

function wireMeterUI() {
    window.addEventListener("load", () => drawTimeline());
    window.addEventListener("resize", () => drawTimeline());
}

//=====Main init=====

export function initUI(tracks) {
    tracks.forEach(track => wireTrackUI(track));
    wirePeakPickerUI();
    wireSpectrumUI();
    wireDissonanceCurveUI();
    wireMeterUI();
}