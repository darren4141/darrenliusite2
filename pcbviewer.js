const viewerConfigs = [
    {
        id: "viewer1",
        path: "PCBanimation/STM32_FC_Board/board render",
        start: 0,
        end: 208,
    },
    {
        id: "viewer2",
        path: "PCBanimation/ESP32_FC_Board/board render",
        start: 213,
        end: 465,
    },
    {
        id: "viewer3",
        path: "PCBanimation/Diff_Breakout_Board_a/board render",
        start: 0,
        end: 237,
    },
    {
        id: "viewer4",
        path: "PCBanimation/Coil_Driver_Board/board render",
        start: 0,
        end: 208,
    },
    {
        id: "viewer5",
        path: "PCBanimation/CM4_Interface_Board/board render",
        start: 0,
        end: 255,
    },
];

const viewers = [];

function createViewer(imgId, pathPrefix, minFrame, maxFrame, sensitivity = 5) {
    const img = document.getElementById(imgId);
    if (!img) return; // Only set up if element exists

    const frameCount = maxFrame - minFrame + 1;
    let currentFrame = 0;
    let isDragging = false;
    let startX = 0;
    let autoRotate = true;

    function preloadFrames() {
        let i = minFrame + 1;
        function loadNext() {
            if (i > maxFrame) return;
            const image = new Image();
            image.src = `${pathPrefix}${i}.webp`;
            i++;
            setTimeout(loadNext, 5);
        }
        loadNext();
    }

    function updateFrame(offset = 1) {
        currentFrame = (currentFrame + offset + frameCount) % frameCount;
        img.src = `${pathPrefix}${minFrame + currentFrame}.webp`;
    }

    img.src = `${pathPrefix}${minFrame}.webp`;
    preloadFrames();

    img.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        autoRotate = false;
        updateToggleButton(imgId, false);
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaFrames = Math.floor(deltaX / sensitivity);
        if (deltaFrames !== 0) {
            updateFrame(deltaFrames);
            startX = e.clientX;
        }
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    img.ondragstart = () => false;

    // Auto-rotate loop
    let interval = setInterval(() => {
        if (autoRotate) updateFrame(1);
    }, 40);

    viewers.push({
        img,
        reset: () => {
            autoRotate = false;
            const targetFrame = 0;
            const forwardSteps = (frameCount + targetFrame - currentFrame) % frameCount;
            const backwardSteps = (frameCount + currentFrame - targetFrame) % frameCount;
            const direction = forwardSteps <= backwardSteps ? 1 : -1;
            const steps = Math.min(forwardSteps, backwardSteps);

            let stepsRemaining = steps;
            const animateReset = () => {
                if (stepsRemaining <= 0) {
                    currentFrame = targetFrame;
                    img.src = `${pathPrefix}${minFrame + currentFrame}.webp`;
                    updateToggleButton(imgId, false);
                    return;
                }
                currentFrame = (currentFrame + direction + frameCount) % frameCount;
                img.src = `${pathPrefix}${minFrame + currentFrame}.webp`;
                stepsRemaining--;
                setTimeout(animateReset, 5); // Adjust speed here
            };

            animateReset();
        },
        toggle: () => {
            autoRotate = !autoRotate;
            updateToggleButton(imgId, autoRotate);
        },
    });
}

function updateToggleButton(imgId, isOn) {
    const index = parseInt(imgId.replace("viewer", ""), 10);
    const button = document.getElementById(`toggle-rotate-${index}`);
    if (button) {
        button.textContent = `Rotation: ${isOn ? "ON" : "OFF"}`;
    }
}

function resetViewer(index) {
    if (viewers[index]) viewers[index].reset();
}

function toggleRotation(index) {
    if (viewers[index]) viewers[index].toggle();
}

// Dynamically initialize only viewers that are on the page
for (const config of viewerConfigs) {
    if (document.getElementById(config.id)) {
        createViewer(config.id, config.path, config.start, config.end);
    }
}

function showModal(id) {
    const modal = document.getElementById(id);
    modal.style.display = "flex";
    function outsideClickHandler(e) {
        if (e.target === modal) {
            hideModal(id);
            modal.removeEventListener('click', outsideClickHandler);
        }
    }
    setTimeout(() => {
        modal.addEventListener('click', outsideClickHandler);
    }, 0);
}

function hideModal(id) {
    document.getElementById(id).style.display = "none";
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal[style*="display: flex"]');
        if (openModal) {
            openModal.style.display = 'none';
        }
    }
});

window.resetViewer = resetViewer;
window.toggleRotation = toggleRotation;
