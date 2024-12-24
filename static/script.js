document.addEventListener("DOMContentLoaded", () => {
  const MODEL_URL = "/static/ckpt/model.json";
  const METADATA_URL = "/static/ckpt/metadata.json";

  let model, bodyPixModel, webcam, ctx, maxPredictions;
  let currentPoseIndex = 0;
  let score = 0;
  let timeLeft = 10;
  let timer;
  let blinkInterval;

  let poseMatchStartTime = null;
  let currentEffect = null;

  const introContainer = document.getElementById("intro-container");
  const gameContainer = document.getElementById("game-container");
  const startButton = document.getElementById("start-button");
  const poseImage = document.getElementById("pose-image");
  const canvas = document.getElementById("canvas");
  const scoreDisplay = document.getElementById("score");
  const timerDisplay = document.getElementById("timer");
  const body = document.body;

  startButton.addEventListener("click", () => {
    introContainer.style.display = "none";
    gameContainer.style.display = "block";
    init();
  });

  async function init() {
    model = await tmPose.load(MODEL_URL, METADATA_URL);
    maxPredictions = model.getTotalClasses();

    bodyPixModel = await bodyPix.load();
    console.log("BodyPix model loaded.");

    webcam = new tmPose.Webcam(640, 480, true);
    await webcam.setup();
    await webcam.play();

    ctx = canvas.getContext("2d");
    updatePoseImage();
    startTimer();
    window.requestAnimationFrame(loop);
  }

  function startTimer() {
    timer = setInterval(() => {
      timeLeft--;
      timerDisplay.innerText = `Time Left: ${timeLeft}s`;

      if (timeLeft <= 3) {
        startBlinkEffect();
      }

      if (timeLeft <= 0) {
        clearInterval(timer);
        clearInterval(blinkInterval);
        resetBackground();
        endGame();
      }
    }, 1000);
  }

  function startBlinkEffect() {
    let blinkSpeed = 500 / (4 - timeLeft);

    if (blinkInterval) clearInterval(blinkInterval);

    blinkInterval = setInterval(() => {
      body.style.backgroundColor =
        body.style.backgroundColor === "red" ? "white" : "red";
    }, blinkSpeed);
  }

  function resetBackground() {
    body.style.backgroundColor = "white";
  }

  async function loop() {
    webcam.update();
    await predict();
    window.requestAnimationFrame(loop);
  }

  async function predict() {
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);

    let poseMatched = false;

    for (let i = 0; i < maxPredictions; i++) {
      if (
        prediction[i].probability > 0.8 &&
        prediction[i].className === `Pose ${currentPoseIndex + 1}`
      ) {
        poseMatched = true;
        break;
      }
    }

    if (poseMatched) {
      if (!poseMatchStartTime) {
        poseMatchStartTime = Date.now();
        showEffect("Holding...", "orange");
      }

      const poseHeldDuration = Date.now() - poseMatchStartTime;

      if (poseHeldDuration >= 1000) {
        await showPassEffect();
        score += 10;
        scoreDisplay.innerText = `Score: ${score}`;
        timeLeft += 3;

        if (timeLeft > 3) {
          clearInterval(blinkInterval);
          resetBackground();
        }

        updatePoseImage();
        poseMatchStartTime = null;
      }
    } else {
      poseMatchStartTime = null;
      clearEffect();
    }

    drawPersonOnBackground();
  }

  async function drawPersonOnBackground() {
    const segmentation = await bodyPixModel.segmentPerson(webcam.canvas);
    const personOnlyCanvas = document.createElement("canvas");
    const personCtx = personOnlyCanvas.getContext("2d");

    personOnlyCanvas.width = canvas.width;
    personOnlyCanvas.height = canvas.height;

    personCtx.drawImage(webcam.canvas, 0, 0);
    const imageData = personCtx.getImageData(0, 0, personOnlyCanvas.width, personOnlyCanvas.height);
    const pixelData = imageData.data;

    for (let i = 0; i < pixelData.length; i += 4) {
      if (!segmentation.data[i / 4]) {
        pixelData[i + 3] = 0; // 투명 처리
      }
    }

    personCtx.putImageData(imageData, 0, 0);

    const background = new Image();
    background.src = poseImage.src;

    background.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(personOnlyCanvas, 0, 0, canvas.width, canvas.height);
    };
  }

  function updatePoseImage() {
    currentPoseIndex = Math.floor(Math.random() * 10);
    poseImage.src = `/static/images/${currentPoseIndex + 1}.PNG`;
  }

  async function showPassEffect() {
    return new Promise((resolve) => {
      showEffect("Pass!", "green", 500);
      body.style.backgroundColor = "green";

      setTimeout(() => {
        resetBackground();
        resolve();
      }, 500);
    });
  }

  function showEffect(message, color = "orange", duration = 1000) {
    if (currentEffect) currentEffect.remove();

    const effectDiv = document.createElement("div");
    effectDiv.innerText = message;
    effectDiv.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 2.5rem; font-weight: bold;
      color: white; z-index: 1000;
    `;
    document.body.appendChild(effectDiv);

    body.style.backgroundColor = color;

    currentEffect = effectDiv;

    setTimeout(() => {
      effectDiv.remove();
      resetBackground();
    }, duration);
  }

  function clearEffect() {
    if (currentEffect) {
      currentEffect.remove();
      currentEffect = null;
    }
  }

  function endGame() {
    let playerName = prompt("Game Over! 이름을 입력해주세요:") || "User";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/gameover";

    form.appendChild(createHiddenInput("name", playerName));
    form.appendChild(createHiddenInput("score", score));
    document.body.appendChild(form);
    form.submit();
  }

  function createHiddenInput(name, value) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    return input;
  }
});
