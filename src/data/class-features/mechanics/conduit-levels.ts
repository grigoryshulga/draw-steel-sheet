import type { FeatureMechanics } from "../types";

/** Авторская механика Проводника для неконтейнерных записей уровней 2–10. */
export const CONDUIT_LEVEL_MECHANICS: Record<string, FeatureMechanics> = {
  "conduit.feature.2.spiski-nebes-the-lists-of-heaven": { kinds: ["trigger"], trigger: { event: "spend-recovery", frequency: "always", label: "Существо тратит Восстановление", detail: "Когда вы позволяете другому существу потратить Восстановление, вы также можете потратить Восстановление." } },
  "conduit.feature.2.osobennost-domena-2-go-urovnya": { kinds: ["choice", "grant"], notes: "Получаете особенность 1-го уровня и навык второго домена, выбранного при создании; level-up определяет невзятый домен из пары и выдаёт его особенность и навык." },
  "conduit.feature.2.sposobnost-domena-2-go-urovnya": { kinds: ["choice", "grant"], choice: { group: "conduit.ability.domain.2", options: [] }, notes: "Выбор одной доменной способности 2-го уровня из двух выбранных доменов; level-up строит конкретные варианты по conduit-abilities и сохранённой паре доменов." },
  "conduit.feature.3.sposobnost-za-7-blagochestiya": { kinds: ["choice", "grant"], notes: "Выбрать одну из четырёх перечисленных способностей за 7 Благочестия. В данных level-up нет группы для выбора способности этой стоимости; не создаём фиктивную группу." },
  "conduit.feature.4.blagoslovennye-domeny-blessed-domain": { kinds: ["trigger", "situational"], trigger: { event: "passive", frequency: "always", label: "Получаешь Благочестие от эффекта домена", detail: "Когда вы получаете Благочестие от эффекта домена, получаете ещё +1 Благочестие." }, notes: "Контекстное напоминание: модель не поддерживает событие получения ресурса от эффекта домена. Условная прибавка +1 не включена как постоянное начисление; применяйте её только при указанном событии." },
  "conduit.feature.4.uvelichenie-kharakteristik": { kinds: ["characteristic"], notes: "Интуиция устанавливается на 3; ещё одна характеристика повышается на 1 до максимума 3. Эти повышения реализует level-up, поэтому аддитивный эффект здесь задвоил бы изменение." },
  "conduit.feature.4.osobennost-domena-4-go-urovnya": { kinds: ["choice", "grant"], choice: { group: "conduit.domain.4", options: [] }, notes: "Выбор одного из двух доменов; level-up строит варианты по выбранной паре доменов, а следующая особенность на уровне 5 автоматически выдаётся для другого домена." },
  "conduit.feature.5.osobennost-domena-5-go-urovnya": { kinds: ["grant"], notes: "Получаете особенность домена 4-го уровня для домена, особенность которого не выбрана на 4-м уровне; контейнерная особенность домена." },
  "conduit.feature.5.sposobnost-za-9-blagochestiya": { kinds: ["choice", "grant"], notes: "Выбрать одну из четырёх перечисленных способностей за 9 Благочестия. В данных level-up нет группы для выбора способности этой стоимости; не создаём фиктивную группу." },
  "conduit.feature.6.rastsvetayushchiy-svyatoy": {
    kinds: ["situational", "trigger", "immunity"],
    choice: { group: "conduit.blooming-saint-immunity", options: [{ id: "corruption", label: "Порча 10" }, { id: "holy", label: "Святой урон 10" }] },
    trigger: { event: "deal-damage", frequency: "always", label: "Наносишь урон врагу", detail: "Когда вы наносите урон врагу, можете потратить Восстановление." },
    effects: [
      { kind: "damageImmunity", types: ["порча"], value: 10, when: { keyValue: ["corruption"] } },
      { kind: "damageImmunity", types: ["святой"], value: 10, when: { keyValue: ["holy"] } },
    ],
    notes: "Выбор иммунитета доступен в интерфейсе классовых особенностей как conduit.blooming-saint-immunity: без сохранённого выбора ни один из двух иммунитетов не активен. Особенность также даёт преимущество на тесты Присутствия для взаимодействия с существами и меняет вид одежды/снаряжения; эти эффекты остаются контекстными.",
  },
  "conduit.feature.6.sposobnost-domena-6-go-urovnya": { kinds: ["choice", "grant"], choice: { group: "conduit.ability.domain.6", options: [] }, notes: "Выбор одной доменной способности 6-го уровня из двух доменов; level-up строит конкретные варианты по conduit-abilities и сохранённой паре доменов." },
  "conduit.feature.7.uvelichenie-kharakteristik": { kinds: ["characteristic"], notes: "Все характеристики увеличиваются на 1 до максимума 4; повышение уровня уже применяет это изменение." },
  "conduit.feature.7.nagrada-veruyushchego-faithful-s-reward": { kinds: ["resourceGain"], resource: { name: "Благочестие", gains: [{ tag: "start-of-turn", event: "start-of-turn", amount: "1d3 + 1", frequency: "turn", replaces: ["start-of-turn"] }] }, notes: "В начале боевого хода бросок Благочестия становится 1d3 + 1 вместо базовых 1d3; заменяет базовый тег start-of-turn." },
  "conduit.feature.7.osobennost-domena-7-go-urovnya": { kinds: ["choice", "grant"], choice: { group: "conduit.domain.7", options: [] }, notes: "Выбор одного из двух доменов; level-up строит варианты по выбранной паре доменов, а следующая особенность на уровне 8 автоматически выдаётся для другого домена." },
  "conduit.feature.8.osobennost-domena-8-go-urovnya": { kinds: ["grant"], notes: "Получаете особенность домена 7-го уровня для домена, особенность которого не выбрана на 7-м уровне; контейнерная особенность домена." },
  "conduit.feature.8.sposobnost-za-11-blagochestiya": { kinds: ["choice", "grant"], notes: "Выбрать одну из четырёх перечисленных способностей за 11 Благочестия. В данных level-up нет группы для выбора способности этой стоимости; не создаём фиктивную группу." },
  "conduit.feature.9.mech-very-faith-s-sword": { kinds: ["situational", "resource", "trigger"], trigger: { event: "respite", frequency: "respite", label: "Передаёшь Расцветающего святого союзнику", detail: "После совместного отдыха выберите согласного союзника-героя: он получает преимущества Расцветающего святого до вашего следующего отдыха. Как свободный манёвр можно потратить Благочестие, чтобы дать ему 1 очко его Героического Ресурса за каждые 2 потраченных Благочестия." }, notes: "Передача зависит от выбора согласного союзника и длится до следующего отдыха; стоимость передаваемого ресурса игрок выбирает вручную." },
  "conduit.feature.9.posvyashchennyy-ordained": { kinds: ["bonus", "situational"], notes: "Характеристики считаются на 1 выше только для сопротивления потенциалам. Это контекстное правило, не постоянный бонус листовой характеристики; при 5+ Победах также меняется голос и даётся двойное преимущество на некоторые проверки Присутствия." },
  "conduit.feature.9.sposobnost-domena-9-go-urovnya": { kinds: ["choice", "grant"], choice: { group: "conduit.ability.domain.9", options: [] }, notes: "Выбор одной доменной способности 9-го уровня из двух доменов; level-up строит конкретные варианты по conduit-abilities и сохранённой паре доменов." },
  "conduit.feature.10.avatar": { kinds: ["situational"], notes: "Молитва допускает до трёх одновременных эффектов; активация эффекта домена без молитвы и портал божества на отдыхе требуют выбора/нарратива." },
  "conduit.feature.10.uvelichenie-kharakteristik": { kinds: ["characteristic"], notes: "Интуиция устанавливается на 5; ещё одна характеристика повышается на 1 до максимума 5. Повышение реализуется уровнем." },
  "conduit.feature.10.bozhestvennaya-sila": { kinds: ["resource"], notes: "Эпический пул Божественной силы (полученный Опыт после отдыха, сохранение между отдыхами, трата как Благочестия и применение незнакомых способностей Проводника) подключается отдельно; здесь пул ещё не включён." },
  "conduit.feature.10.samyy-blagochestivyy": { kinds: ["resourceGain"], resource: { name: "Благочестие", gains: [{ tag: "prayer-bonus", event: "start-of-turn", amount: "1", frequency: "turn" }] }, notes: "Это отдельная прибавка +1 при молитве во время броска благочестия в начале боевого хода; она складывается с броском уровня 7. ResourceGain не умеет выразить условие «если молишься», поэтому строка отмечает событие начала хода, а условие оставлено в тексте." },
};

/** Записи с явной причиной, почему они пока представлены текстом. */
export const CONDUIT_LEVEL_TEXT_ONLY: Record<string, string> = {
  "conduit.feature.2.perk": "На 2-м уровне выбирается ремесленный перк, перк знаний или сверхъестественный перк; автоматическая выдача зависит от выбора из каталога перков.",
  "conduit.feature.3.maloe-chudo-minor-miracle": "Возвращение к жизни зависит от останков, срока смерти, согласия души и решения ведущего; кроме того, проводник восстанавливает только половину своих Восстановлений после отдыха. Деятельность и изменение остатка пока не автоматизированы.",
  "conduit.feature.4.perk": "Выбирается один перк из каталога; подходящий тип ограничен формулировкой книги, выдача зависит от каталога перков.",
  "conduit.feature.4.navyk": "Выбирается один навык из каталога навыков; значение выбора не хранится механикой этой записи.",
  "conduit.feature.6.perk": "Выбирается ремесленный перк, перк знаний или сверхъестественный перк; выдача зависит от каталога перков.",
  "conduit.feature.7.navyk": "Выбирается один навык из каталога навыков; значение выбора не хранится механикой этой записи.",
  "conduit.feature.8.perk": "Выбирается один перк из каталога; выдача зависит от каталога перков.",
  "conduit.feature.10.perk": "Выбирается ремесленный перк, перк знаний или сверхъестественный перк; выдача зависит от каталога перков.",
  "conduit.feature.10.navyk": "Выбирается один навык из каталога навыков; значение выбора не хранится механикой этой записи.",
};
