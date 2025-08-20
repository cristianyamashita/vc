const i18n = {
    en: {
        title: "Full Screen Message",
        settingsTitle: "Settings",
        messageLabel: "Message",
        messagePlaceholder: "Enter your message here...",
        bgColorLabel: "Background Color",
        fontColorLabel: "Font Color",
        fontSizeLabel: "Font Size (px)",
        fontShadowLabel: "Font Shadow",
        fontShadowPlaceholder: "e.g., 2px 2px 4px #000000",
        fullscreenBtn: "Show Full Screen"
    },
    pt: {
        title: "Mensagem em Tela Cheia",
        settingsTitle: "Configurações",
        messageLabel: "Mensagem",
        messagePlaceholder: "Digite sua mensagem aqui...",
        bgColorLabel: "Cor de Fundo",
        fontColorLabel: "Cor da Fonte",
        fontSizeLabel: "Tamanho da Fonte (px)",
        fontShadowLabel: "Sombra da Fonte",
        fontShadowPlaceholder: "ex: 2px 2px 4px #000000",
        fullscreenBtn: "Exibir em Tela Cheia"
    },
    ja: {
        title: "フルスクリーンメッセージ",
        settingsTitle: "設定",
        messageLabel: "メッセージ",
        messagePlaceholder: "ここにメッセージを入力してください...",
        bgColorLabel: "背景色",
        fontColorLabel: "フォントの色",
        fontSizeLabel: "フォントサイズ (px)",
        fontShadowLabel: "フォントの影",
        fontShadowPlaceholder: "例: 2px 2px 4px #000000",
        fullscreenBtn: "フルスクリーンで表示"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const langSwitcher = document.getElementById('lang-switcher');
    const themeSwitcher = document.getElementById('theme-switcher');
    const messageTextInput = document.getElementById('message-text');
    const backgroundColorInput = document.getElementById('background-color');
    const fontColorInput = document.getElementById('font-color');
    const fontSizeInput = document.getElementById('font-size');
    const fontShadowInput = document.getElementById('font-shadow');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const fullscreenContainer = document.getElementById('fullscreen-container');
    const fullscreenMessage = document.getElementById('fullscreen-message');

    // --- State ---
    let currentLanguage = localStorage.getItem('app_lang') || 'en';
    let currentTheme = localStorage.getItem('app_theme') || 'dark';
    let settings = JSON.parse(localStorage.getItem('fullscreen_message_settings')) || {
        message: '',
        bgColor: '#000000',
        fontColor: '#FFFFFF',
        fontSize: 60,
        fontShadow: ''
    };

    // --- Functions ---
    const applyI18n = () => {
        const lang = i18n[currentLanguage] || i18n.en;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (lang[key]) el.innerText = lang[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (lang[key]) el.placeholder = lang[key];
        });
        document.title = lang.title;
    };

    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = themeSwitcher.querySelector('i');
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('app_theme', theme);
    };

    const saveSettings = () => {
        settings.message = messageTextInput.value;
        settings.bgColor = backgroundColorInput.value;
        settings.fontColor = fontColorInput.value;
        settings.fontSize = fontSizeInput.value;
        settings.fontShadow = fontShadowInput.value;
        localStorage.setItem('fullscreen_message_settings', JSON.stringify(settings));
    };

    const loadSettings = () => {
        messageTextInput.value = settings.message;
        backgroundColorInput.value = settings.bgColor;
        fontColorInput.value = settings.fontColor;
        fontSizeInput.value = settings.fontSize;
        fontShadowInput.value = settings.fontShadow;
    };

    // --- Event Listeners ---
    langSwitcher.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        localStorage.setItem('app_lang', currentLanguage);
        applyI18n();
    });

    themeSwitcher.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
    });

    [messageTextInput, backgroundColorInput, fontColorInput, fontSizeInput, fontShadowInput].forEach(input => {
        input.addEventListener('input', saveSettings);
    });

    fullscreenBtn.addEventListener('click', () => {
        // Ensure settings are up-to-date before showing
        saveSettings();

        // Apply styles
        fullscreenContainer.style.backgroundColor = settings.bgColor;
        fullscreenMessage.style.color = settings.fontColor;
        fullscreenMessage.style.fontSize = `${settings.fontSize}px`;
        fullscreenMessage.style.textShadow = settings.fontShadow;
        fullscreenMessage.innerText = settings.message;

        // Show and request fullscreen
        fullscreenContainer.style.display = 'flex';
        fullscreenContainer.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            fullscreenContainer.style.display = 'none';
        }
    });

    // --- Initial Setup ---
    langSwitcher.value = currentLanguage;
    applyI18n();
    applyTheme(currentTheme);
    loadSettings();
});
