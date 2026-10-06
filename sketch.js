let video;
let video_width = 768;
let video_height = 576;

let video_slice_left   = Math.floor(video_width * 0.25);
let video_slice_center = Math.floor(video_width * 0.5);
let video_slice_right  = Math.floor(video_width * 0.75);

let window_width = 1000;
let window_height = video_height;
let draw_position_x = 0;

// audio state
let audioEnabled = false;
let audioGraphReady = false;

// samples + fx
let choir, metal, lp, rev, metalHP;
let curRateC = 1, curRateM = 1, curCut = 800, curWet = 0.35, curMix = 0.5;

// control osc (used for sound manip, (silent))
let osc, lfoPhase = 0;
let lfoDepth = 0.25;
let baseAmp = 0.22;

// smoothers
let mLuma = 128;
let mLfoFreq = 0.5;

// trailer + state
let currentTrailer = null;
let sketchReady = false;

function preload() {
  soundFormats('mp3','wav');
  choir = loadSound('/assets/choir.wav');
  metal = loadSound('/assets/metal_drone.wav');
}

function setup() {
  const cnv = createCanvas(window_width, window_height);
  cnv.parent('canvas-container');
  pixelDensity(1);
  background(0);

  sketchReady = true;
  initVideo(); 

  // save 
  const exportButton = document.getElementById('button');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      saveCanvas('graph0', 'png');
    });
  }

  // back 
  const backBtn = document.getElementById('backButton');
  if (backBtn) {
    backBtn.addEventListener('click', goBackToLanding);
  }
}

// audio graph
function initAudioGraph() {
  if (audioGraphReady) return;
  if (!choir || !metal) return;

  osc = new p5.Oscillator('sine');
  osc.start();
  osc.amp(0);

  lp = new p5.LowPass();
  rev = new p5.Reverb();
  metalHP = new p5.HighPass();

  choir.disconnect();
  metal.disconnect();

  // choir → lp
  choir.connect(lp);

  // metal → HPF → lp
  metal.connect(metalHP);
  metalHP.freq(600);
  metalHP.res(3);
  metalHP.connect(lp);

  rev.process(lp, 5, 0.7);
  rev.drywet(curWet);

  choir.loop();
  metal.loop();

  choir.amp(0);
  metal.amp(0);

  choir.rate(1.0);
  metal.rate(1.0);

  audioGraphReady = true;
  console.log("Audio graph ready");
}

function initVideo() {
  if (!sketchReady || !currentTrailer) return;

  if (video) {
    video.stop();
    video.remove();
    video = null;
  }

  video = createVideo(currentTrailer, videoLoaded);
  video.size(video_width, video_height);
  video.hide();
  video.volume(0);
  video.loop();
  background(0);
  draw_position_x = 0;
}

function videoLoaded() {
  console.log("video loaded and playing:", currentTrailer);
}

function draw() {
  if (!video || !video.loadedmetadata) return;

  video.loadPixels();
  loadPixels();

  if (video.pixels.length > 0 && pixels.length > 0) {
    if (draw_position_x >= window_width - 3) draw_position_x = 0;

    let sumLumaL = 0, sumLumaC = 0, sumLumaR = 0;

    for (let y = 0; y < video_height; y++) {
      // left
      let vi = (y * video_width + video_slice_left) * 4;
      let r = video.pixels[vi+0], g = video.pixels[vi+1], b = video.pixels[vi+2];
      let lL = 0.2126*r + 0.7152*g + 0.0722*b;
      sumLumaL += lL;

      // center
      vi = (y * video_width + video_slice_center) * 4;
      r = video.pixels[vi+0]; g = video.pixels[vi+1]; b = video.pixels[vi+2];
      let lC = 0.2126*r + 0.7152*g + 0.0722*b;
      sumLumaC += lC;

      // right
      vi = (y * video_width + video_slice_right) * 4;
      r = video.pixels[vi+0]; g = video.pixels[vi+1]; b = video.pixels[vi+2];
      let lR = 0.2126*r + 0.7152*g + 0.0722*b;
      sumLumaR += lR;

      const xL = draw_position_x;
      const xC = draw_position_x + 1;
      const xR = draw_position_x + 2;

      let ci = (y * window_width + xL) * 4;
      pixels[ci+0] = lL; pixels[ci+1] = lL; pixels[ci+2] = lL; pixels[ci+3] = 255;

      ci = (y * window_width + xC) * 4;
      pixels[ci+0] = lC; pixels[ci+1] = lC; pixels[ci+2] = lC; pixels[ci+3] = 255;

      ci = (y * window_width + xR) * 4;
      pixels[ci+0] = lR; pixels[ci+1] = lR; pixels[ci+2] = lR; pixels[ci+3] = 255;
    }

    updatePixels();

    if (audioEnabled && audioGraphReady && choir.isLoaded() && metal.isLoaded()) {
      const avgLumaL = sumLumaL / video_height;
      const avgLumaC = sumLumaC / video_height;
      const avgLumaR = sumLumaR / video_height;
      const avgLumaAll = (avgLumaL + avgLumaC + avgLumaR) / 3;

      mLuma = lerp(mLuma, avgLumaAll, 0.03);
      const targetLfo = map(mLuma, 0,255, 0.08, 2.0);
      mLfoFreq = lerp(mLfoFreq, targetLfo, 0.05);

      // center slit = mix
      const targetMix = map(avgLumaC, 0,255, 0.2, 0.8);
      curMix = lerp(curMix, targetMix, 0.08);

      // left slit = choir speed
      const targetRateC = map(avgLumaL, 0,255, 0.92, 1.08);
      // right slit = metal speed
      const targetRateM = map(avgLumaR, 0,255, 0.85, 1.03);

      curRateC = lerp(curRateC, targetRateC, 0.08);
      curRateM = lerp(curRateM, targetRateM, 0.08);

      osc.freq(mLfoFreq);
      lfoPhase += TWO_PI * mLfoFreq * (deltaTime/1000);
      const lfo = (sin(lfoPhase) + 1) * 0.5;

      const targetCut = map(mLuma, 0,255, 300, 3200);
      const wobble = map(lfo, 0,1, -60, 60);
      curCut = lerp(curCut, targetCut + wobble, 0.03);

      const targetWet = map(mLuma, 0,255, 0.30, 0.55);
      curWet = lerp(curWet, targetWet, 0.06);
      
      lp.freq(curCut);
      lp.res(8);
      rev.drywet(curWet);

      choir.rate(curRateC);
      metal.rate(curRateM);

      // AMP
      const aChoir = baseAmp * (0.7 + lfoDepth * lfo) * curMix;

      // metal volume driven by right slit brightness
      const rightDark = 1 - constrain(avgLumaR / 255, 0, 1);
      const texBoost = map(rightDark, 0,1, 0.2, 1.0);

      const aMetalBase = baseAmp * (0.6 + 0.4 * (1 - lfo)) * (1 - curMix);
      const aMetal = aMetalBase * texBoost;
      
      choir.amp(aChoir, 0.12);
      metal.amp(aMetal, 0.12);


    }

    draw_position_x += 3;
  }

  stroke(255, 80);
  line(draw_position_x, 0, draw_position_x, height);
}

// called from HTML
function setTrailer(path) {
  currentTrailer = path;

 
  if (!audioGraphReady) {
    userStartAudio();      // uses click as gesture
    initAudioGraph();
  }
  audioEnabled = true;

  const landing = document.getElementById('landing');
  if (landing) landing.classList.add('hidden');

  const cc = document.getElementById('canvas-container');
  if (cc) cc.classList.remove('hidden');

  const saveBtn = document.getElementById('button');
  if (saveBtn) saveBtn.classList.remove('hidden');

  const backBtn = document.getElementById('backButton');
  if (backBtn) backBtn.classList.remove('hidden');

  initVideo();
}

function goBackToLanding() {
  // hide canvas + buttons
  const cc = document.getElementById('canvas-container');
  if (cc) cc.classList.add('hidden');

  const saveBtn = document.getElementById('button');
  if (saveBtn) saveBtn.classList.add('hidden');

  const backBtn = document.getElementById('backButton');
  if (backBtn) backBtn.classList.add('hidden');

  // show landing
  const landing = document.getElementById('landing');
  if (landing) landing.classList.remove('hidden');

  // stop video
  if (video) {
    video.stop();
    video.remove();
    video = null;
  }

  // fade out audio, but keep graph ready
  audioEnabled = false;
  if (choir) choir.amp(0, 0.2);
  if (metal) metal.amp(0, 0.2);

  console.log("returned.");
}

