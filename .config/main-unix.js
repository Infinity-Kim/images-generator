const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const path = require('path');

// Основные пути
const OUTPUT_DIR = path.join(__dirname, '../out');
const TEMP_FILE = path.join(__dirname, '../temp.txt');
const PHRASES_FILE = path.join(__dirname, '../phrases.txt');
const DEFAULT_SETTINGS_FILE = path.join(__dirname, 'default-settings.json');
const USER_SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Удаляем ~/.carbon-now.json в начале (если нужно)
const carbonNowConfig = path.join(os.homedir(), '.carbon-now.json');
if (fs.existsSync(carbonNowConfig)) {
    fs.rmSync(carbonNowConfig, { force: true });
}

// 1. Очищаем и пересоздаём каталог out
if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 2. Загружаем default-setting.json
const defaultSettings = JSON.parse(fs.readFileSync(DEFAULT_SETTINGS_FILE, 'utf8'));

// 3. Если есть settings.json, мёржим в поле custom
if (fs.existsSync(USER_SETTINGS_FILE)) {
    const userSettings = JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8'));
    defaultSettings.custom = {
        ...(defaultSettings.custom || {}),
        ...userSettings
    };
}

// 4. Подготавливаем строку настроек
const settingsString = JSON.stringify(defaultSettings);

/**
 * Формирует название файла из первых N слов текста.
 * - Разрешаем латиницу, кириллицу, цифры, подчёркивания, дефисы.
 * - Всё остальное вырезаем из слова.
 * - Если после вырезания слово пустое, пропускаем его.
 * - Склеиваем слова через нижнее подчеркивание и добавляем .png
 */
function makeFileNameFromChunk(chunk, wordLimit = 6) {
    const words = chunk
        // Разделяем по пробельным символам
        .split(/\s+/)
        // Берём только первые N слов
        .slice(0, wordLimit)
        // Очищаем слово от символов, не являющихся
        // латиницей, кириллицей, цифрами, подчёркиваниями или дефисами
        .map(word => word.replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, ''))
        // Исключаем пустые слова (после вырезания пунктуации
        // может оказаться, что слово стало '')
        .filter(Boolean);

    // Если все слова оказались пустыми, fallback = 'snippet'
    return words.join('_') || 'snippet';
}

// 5. Считываем phrases.txt и разбиваем по разделителю ===DELIMITER===
const rawContent = fs.readFileSync(PHRASES_FILE, 'utf8');
const data = rawContent.split('===DELIMITER===');

let processed = 0;
const total = data.length;

for (const chunk of data) {
    const trimmed = chunk.trim();
    if (!trimmed) {
        continue;
    }

    processed++;
    console.log(`Processing chunk: ${processed} / ${total}`);

    fs.writeFileSync(TEMP_FILE, trimmed, 'utf8');

    // Генерируем имя файла
    const saveAsName = makeFileNameFromChunk(trimmed) + '_' + processed;

    // В зависимости от платформы вызываем команду
    const carbonResult = spawnSync('/bin/sh', [
        '-c',
        'carbon-now',
        'temp.txt',
        '--save-to',
        'out',
        '--save-as',
        saveAsName,
        '--settings',
        settingsString
    ], { stdio: 'inherit' });

    if (carbonResult.status !== 0) {
        console.error('[ERROR] An error occurred while running carbon-now.');
        console.log('[DEBUG] Full spawnSync result:', carbonResult);
        process.exit(1);
    }

    // Удаляем временный файл
    if (fs.existsSync(TEMP_FILE)) {
        fs.unlinkSync(TEMP_FILE);
    }
}
