const widgetPackageBase = 'https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/';
const widgetDistBase = `${widgetPackageBase}dist/`;
const officialModelBase =
    'https://fastly.jsdelivr.net/gh/Live2D/CubismWebSamples@5-r.5/Samples/Resources/';

const officialModels = [
    'Haru',
    'Hiyori',
    'Mao',
    'Mark',
    'Natori',
    'Ren',
    'Rice',
    'Wanko',
].map((name) => ({
    name,
    paths: [`${officialModelBase}${name}/${name}.model3.json`],
    message: `Live2D 官方示例角色：${name}`,
}));

function loadStylesheet(url) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
    });
}

async function loadLive2D() {
    const OriginalImage = window.Image;
    window.Image = function (...args) {
        const image = new OriginalImage(...args);
        image.crossOrigin = 'anonymous';
        return image;
    };
    window.Image.prototype = OriginalImage.prototype;

    const [, tipsResponse] = await Promise.all([
        import(`${widgetDistBase}waifu-tips.js`),
        fetch(`${widgetDistBase}waifu-tips.json`),
        loadStylesheet(`${widgetDistBase}waifu.css`),
    ]);

    if (!tipsResponse.ok) {
        throw new Error(`Live2D configuration request failed: ${tipsResponse.status}`);
    }

    const tips = await tipsResponse.json();
    const bundledModels = tips.models.filter(({ name }) => name !== 'Hiyori');
    tips.models = [...bundledModels, ...officialModels];

    const configUrl = URL.createObjectURL(
        new Blob([JSON.stringify(tips)], { type: 'application/json' }),
    );
    const initWidget = window.initWidget;

    if (typeof initWidget !== 'function') {
        throw new Error('Live2D widget initializer is unavailable');
    }

    initWidget({
        waifuPath: configUrl,
        cubism2Path: `${widgetDistBase}live2d.min.js`,
        cubism5Path:
            'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
        modelId: Math.floor(Math.random() * tips.models.length),
        tools: [
            'hitokoto',
            'asteroids',
            'switch-model',
            'switch-texture',
            'photo',
            'info',
            'quit',
        ],
        logLevel: 'warn',
        drag: false,
    });
}

loadLive2D().catch((error) => {
    console.error('Failed to load Live2D widget:', error);
});
