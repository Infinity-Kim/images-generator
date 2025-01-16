const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const path = require('path');

// Основные пути
const OUTPUT_DIR = path.join(__dirname, '../.out');
const TEMP_FILE = path.join(__dirname, '../temp.txt');
const PHRASES_FILE = path.join(__dirname, '../phrases.txt');
const USER_SETTINGS_FILE = path.join(__dirname, '../settings.json');
const DEFAULT_SETTINGS_FILE = path.join(__dirname, 'default-settings.json');

// 0. Удаляем ~/.carbon-now.json из домашней директории
const homeDir = os.homedir();
const carbonNowConfigPath = path.join(homeDir, '.carbon-now.json');

if (fs.existsSync(carbonNowConfigPath)) {
  fs.rmSync(carbonNowConfigPath, { force: true });
}


// 1. Удаляем (если есть) и создаём каталог .out
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// 2. Загружаем default-setting.json в объект
const defaultSettings = JSON.parse(fs.readFileSync(DEFAULT_SETTINGS_FILE, 'utf8'));

// 3. Если существует settings.json, читаем и добавляем в поле custom
if (fs.existsSync(USER_SETTINGS_FILE)) {
  const userSettings = JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8'));
  // Если в defaultSettings уже есть custom, объединим с userSettings
  // Если нет, инициализируем пустым объектом
  defaultSettings.custom = {
    ...(defaultSettings.custom || {}),
    ...userSettings
  };
} else {
  const {custom, ...rest} = defaultSettings;

  // Если в defaultSettings уже есть custom, удалим его
  if (custom) {
    defaultSettings = rest;
  }
}

// Формируем строку для --settings
const settingsString = JSON.stringify(defaultSettings);

// 2. Считываем phrases.txt и разбиваем по разделителю ===DELIMITER===
const rawContent = fs.readFileSync(PHRASES_FILE, 'utf8');
const data = rawContent.split('===DELIMITER===');

// 3. Перебираем каждый фрагмент
let processed = 0;
const total = data.length;

for (const chunk of data) {
  const trimmed = chunk.trim();
  if (!trimmed) {
    // Пропускаем пустые куски (когда есть разделитель в конце или лишняя пустая строка)
    continue;
  }

  processed++;
  console.log(`Processing chunk: ${processed} / ${total}`);

  // 3.1 Записываем фрагмент во временный файл temp.txt
  fs.writeFileSync(TEMP_FILE, trimmed, 'utf-8');

  const args = [
    '/c',            // флаг cmd: выполнить и выйти
    'carbon-now',
    'temp.txt',
    '--save-to',
    '.out',
    '--settings',
    settingsString      // здесь JSON в одинарных кавычках
  ];

  // 3.2 Вызываем carbon-now, передавая путь к файлу temp.txt
  // Обратите внимание на указание --save-to ./.out, 
  // чтобы все сгенерированные изображения оказались в папке .out
  const carbonResult = spawnSync('cmd', args, { stdio: 'inherit' });

  if (carbonResult.status !== 0) {
    console.error('[ERROR] An error occurred while running carbon-now.');
    console.log('[DEBUG] Full spawnSync result:', carbonResult);
    process.exit(1);
  }

  // 3.3 Удаляем временный файл (или можно не удалять — если хотите посмотреть содержимое)
  if (fs.existsSync(TEMP_FILE)) {
    fs.unlinkSync(TEMP_FILE);
  }
}
