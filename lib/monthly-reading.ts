import { channelChange, metricChange, reviewNumber, type ReviewChannel, type ReviewMetric } from './monthly-review';
import { PLATFORM_LABELS } from './types';

/** Never compare totals built from different sets of observed networks. */
export function consolidatedChange(channels: ReviewChannel[], metric: ReviewMetric) {
  const changes = channels.map(channel => channelChange(channel, metric));
  const sum = (key: 'current' | 'previous') => changes.some(c => c[key] != null) ? changes.reduce((total, c) => total + (c[key] ?? 0), 0) : null;
  const sameScope = changes.every(c => (c.current == null) === (c.previous == null));
  const result = metricChange(sum('current'), sum('previous'));
  return { ...result, difference: sameScope ? result.difference : null, percent: sameScope ? result.percent : null, sameScope };
}
export function monthlyReading(channels: ReviewChannel[]): string[] {
  const interactions = consolidatedChange(channels, 'engagements');
  const views = consolidatedChange(channels, 'views');
  const sentences: string[] = [];
  const change = (value: number) => `${value > 0 ? '+' : ''}${reviewNumber(value)} %`;
  if (interactions.current != null) sentences.push(`${reviewNumber(interactions.current)} interactions enregistrées${interactions.percent != null ? `, soit ${change(interactions.percent)} par rapport à la période précédente` : '. Leur évolution ne peut pas être calculée sur un périmètre comparable'}.`);
  if (views.percent != null && interactions.percent != null && views.percent > 0 && interactions.percent < 0) sentences.push('Les vues augmentent tandis que les interactions diminuent. Cela décrit deux évolutions différentes ; les données seules ne permettent pas de les attribuer aux sujets, au budget publicitaire ou à l’algorithme.');
  const comparable = channels.map(c => ({platform: c.platform, ...channelChange(c, 'engagements')})).filter(c => c.difference != null);
  const driver = comparable.sort((a,b) => Math.abs(b.difference!) - Math.abs(a.difference!))[0];
  if (driver && driver.difference !== 0) sentences.push(`${PLATFORM_LABELS[driver.platform]} présente le plus grand écart mesuré : ${driver.difference! > 0 ? '+' : ''}${reviewNumber(driver.difference)} interactions (${reviewNumber(driver.previous)} → ${reviewNumber(driver.current)}).`);
  if (channels.some(c => c.coverage < 80 || c.previousCoverage < 80)) sentences.push('La collecte est partielle sur au moins un réseau : ces chiffres décrivent les relevés disponibles et doivent être interprétés avec cette limite.');
  return sentences.length ? sentences : ['Pas assez de relevés pour établir une lecture de cette période.'];
}
