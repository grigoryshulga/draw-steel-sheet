import type { BuilderFlowStep } from '../../lib/builder-flow';
import { BUILDER_DATA } from '../../lib/character-builder';

export const englishStages = ['Ancestry', 'Background', 'Class', 'Equipment', 'Abilities', 'Identity', 'Review'];
const labels: Record<string, string> = {
  ancestry: 'Choose an ancestry', 'ancestry-options': 'Ancestry traits',
  'culture/environment': 'Environment', 'culture/organization': 'Organization',
  'culture/upbringing': 'Upbringing', 'culture/skills': 'Culture skills',
  career: 'Choose a career', 'career-options/skills': 'Career skills',
  'career-options/perk': 'Career perk', 'career-options/incident': 'Inciting incident',
  class: 'Choose a class', 'class-options/subclass': 'Subclass',
  'class-options/characteristics': 'Characteristics', 'class-options/skills': 'Class skills',
  kit: 'Choose a kit', 'kit/primary': 'Choose a kit', 'class-options/domain': 'Domain',
  'abilities/signature': 'Signature abilities', 'abilities/3': '3-resource ability', 'abilities/5': '5-resource ability', 'abilities/other': 'Other abilities and triggered actions', 'kit/secondary': 'Second kit', 'kit/bonuses': 'Kit bonuses',
  abilities: 'Abilities', details: 'Hero identity', summary: 'Review your hero',
};
const featureNames: Record<string, string> = {
  'Псионическая аугментация': 'Psionic Augmentation', 'Молитва': 'Prayer',
  'Оберег проводника': 'Conduit Ward', 'Оберег таланта': 'Talent Ward',
  'Зачарование': 'Enchantment', 'Оберег элементалиста': 'Elementalist Ward',
};
export function englishFlowLabel(step: BuilderFlowStep): string {
  if (step.id === 'class-options/subclass' && step.label === 'Домены') return 'Domains';
  if (step.id === 'class-options/domain') return step.label === 'Домен цензора' ? 'Censor domain' : 'Domain for level 1 feature';
  if (step.part.startsWith('feature:')) return featureNames[step.label] ?? 'Class feature';
  return labels[step.id] ?? (step.step === 'abilities' ? 'Choose abilities' : step.step === 'class-options' ? 'Class options' : step.step === 'kit' ? 'Kit options' : step.label);
}

const issueTranslations: Record<string, string> = {
  'Дайте герою имя.': 'Enter a name for your hero.',
  'Выберите происхождение.': 'Choose an ancestry.',
  'Сначала выберите происхождение.': 'Choose an ancestry first.',
  'Выберите навыки происхождения; повторяющиеся навыки замените.': 'Choose ancestry skills and replace any duplicates.',
  'Выберите три аспекта культуры и три разных навыка.': 'Choose all three culture aspects and three different skills.',
  'Выберите три разных навыка культуры.': 'Choose three different culture skills.',
  'Выберите карьеру.': 'Choose a career.',
  'Сначала выберите карьеру.': 'Choose a career first.',
  'Выберите побуждающий инцидент.': 'Choose an inciting incident.',
  'Выберите перк карьеры.': 'Choose a career perk.',
  'Заполните навыки карьеры; повторяющиеся навыки замените.': 'Choose career skills and replace any duplicates.',
  'Выберите класс.': 'Choose a class.',
  'Сначала выберите класс.': 'Choose a class first.',
  'Выберите подкласс (для проводника — два домена).': 'Choose a subclass; a conduit must choose two domains.',
  'Выберите домен цензора.': 'Choose the censor domain.',
  'Выберите домен для особенности 1-го уровня из двух выбранных.': 'Choose which of your two domains grants your level 1 feature.',
  'Выберите домен.': 'Choose a domain.',
  'Выберите дополнительные особенности класса.': 'Choose the additional class features.',
  'Распределение характеристик должно соответствовать одному из наборов класса.': 'Choose one of the class characteristic arrays.',
  'Распределите характеристики по одному из наборов класса.': 'Choose one of the class characteristic arrays.',
  'Заполните навыки класса; повторяющиеся навыки замените.': 'Choose class skills and replace any duplicates.',
  'Выберите комплект.': 'Choose a kit.',
  'Выберите второй, отличный комплект.': 'Choose a different second kit.',
  'Выберите второй, отличный комплект тактика.': 'Choose a different second tactician kit.',
  'Особенности доменов выдаются автоматически только выбранным доменом.': 'Domain features are granted automatically by the chosen domain only.',
  'Выберите по одной героической способности стоимостью 3 и 5 ед. ресурса.': 'Choose one heroic ability costing 3 and one costing 5 heroic resources.',
  'Выберите один триггер проводника.': 'Choose one conduit triggered action.',
  'Выберите доступный шаг.': 'Choose an available step.',
  'Этот вариант недоступен.': 'This option is unavailable.',
};
export function englishIssue(issue: string): string {
  if (issueTranslations[issue]) return issueTranslations[issue];
  let match = issue.match(/^Распределите (\d+) очка происхождения \(выбрано (\d+)\)\.$/);
  if (match) return `Spend ${match[1]} ancestry points (${match[2]} spent).`;
  match = issue.match(/^Выберите способность для черты «(.+)»\.$/);
  if (match) {
    const trait = BUILDER_DATA.ancestries.flatMap(ancestry => ancestry.traits).find(item => item.name === match![1]);
    return trait?.originalName ? `Choose an ability for the trait “${trait.originalName}”.` : 'Choose an ability for this trait.';
  }
  match = issue.match(/^Выберите знаковые способности класса: (\d+)\.$/);
  if (match) return `Choose ${match[1]} class signature abilities.`;
  match = issue.match(/^Выбрано (\d+) из (\d+)\.(.*)$/);
  if (match) return `Selected ${match[1]} of ${match[2]}.${match[3].includes('Замените') ? ' Replace invalid or duplicate skills.' : match[3].includes('Завершите') ? ' Finish choosing class skills.' : ''}`;
  match = issue.match(/^Выберите:\s*(.+)\.$/);
  if (match) {
    const names: Record<string, string> = { ...featureNames, окружение: 'environment', организация: 'organization', воспитание: 'upbringing' };
    return names[match[1]] ? `Choose: ${names[match[1]]}.` : "Choose an option.";
  }
  return issue; // Unknown authored or server text must not be silently replaced.
}
