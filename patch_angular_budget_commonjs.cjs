const fs = require('fs');
const path = require('path');

const angularJsonPath = process.argv[2];
if (!angularJsonPath) {
  console.error('❌ Falta ruta de angular.json');
  process.exit(1);
}

const raw = fs.readFileSync(angularJsonPath, 'utf8');
const json = JSON.parse(raw);

if (!json.projects || typeof json.projects !== 'object') {
  console.error('❌ angular.json no tiene sección projects válida');
  process.exit(1);
}

const requiredCommonJs = [
  'jspdf',
  'jspdf-autotable',
  'canvg',
  'rgbcolor',
  'raf',
  'core-js'
];

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function upsertBudget(container, type, maximumWarning, maximumError) {
  if (!container.budgets || !Array.isArray(container.budgets)) {
    container.budgets = [];
  }
  const existing = container.budgets.find(item => item && item.type === type);
  if (existing) {
    existing.maximumWarning = maximumWarning;
    existing.maximumError = maximumError;
  } else {
    container.budgets.push({ type, maximumWarning, maximumError });
  }
}

for (const projectName of Object.keys(json.projects)) {
  const project = json.projects[projectName];
  const buildTarget = (project.architect && project.architect.build) || (project.targets && project.targets.build);
  if (!buildTarget) {
    console.warn(`⚠ Proyecto '${projectName}' sin target build; se omite.`);
    continue;
  }

  if (!buildTarget.options || typeof buildTarget.options !== 'object') {
    buildTarget.options = {};
  }

  buildTarget.options.allowedCommonJsDependencies = ensureArray(buildTarget.options.allowedCommonJsDependencies);
  for (const dep of requiredCommonJs) {
    if (!buildTarget.options.allowedCommonJsDependencies.includes(dep)) {
      buildTarget.options.allowedCommonJsDependencies.push(dep);
    }
  }

  upsertBudget(buildTarget.options, 'initial', '1.50mb', '2.00mb');
  upsertBudget(buildTarget.options, 'anyComponentStyle', '6kb', '10kb');

  if (!buildTarget.configurations || typeof buildTarget.configurations !== 'object') {
    buildTarget.configurations = {};
  }

  if (!buildTarget.configurations.production || typeof buildTarget.configurations.production !== 'object') {
    buildTarget.configurations.production = {};
  }

  upsertBudget(buildTarget.configurations.production, 'initial', '1.50mb', '2.00mb');
  upsertBudget(buildTarget.configurations.production, 'anyComponentStyle', '6kb', '10kb');

  buildTarget.configurations.production.allowedCommonJsDependencies = ensureArray(buildTarget.configurations.production.allowedCommonJsDependencies);
  for (const dep of requiredCommonJs) {
    if (!buildTarget.configurations.production.allowedCommonJsDependencies.includes(dep)) {
      buildTarget.configurations.production.allowedCommonJsDependencies.push(dep);
    }
  }

  console.log(`✅ Configuración ajustada para proyecto: ${projectName}`);
}

fs.writeFileSync(angularJsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
console.log('✅ angular.json actualizado correctamente.');
