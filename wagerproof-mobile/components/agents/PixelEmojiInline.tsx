import React, { useState, useEffect } from 'react';
import { Image, Text } from 'react-native';

/**
 * Maps emoji characters to their pixel art animation frames (4 frames each).
 * Generated via PixelLab MCP — 32x32px sprites with transparent backgrounds.
 */
export const PIXEL_EMOJI_FRAMES: Record<string, any[]> = {
  // Page 1 — Classic & Power
  '\uD83E\uDD16': [require('@/assets/pixel-office/emoji/robot_f0.png'), require('@/assets/pixel-office/emoji/robot_f1.png'), require('@/assets/pixel-office/emoji/robot_f2.png'), require('@/assets/pixel-office/emoji/robot_f3.png')], // 🤖
  '\uD83E\uDDE0': [require('@/assets/pixel-office/emoji/brain_f0.png'), require('@/assets/pixel-office/emoji/brain_f1.png'), require('@/assets/pixel-office/emoji/brain_f2.png'), require('@/assets/pixel-office/emoji/brain_f3.png')], // 🧠
  '\uD83C\uDFAF': [require('@/assets/pixel-office/emoji/target_f0.png'), require('@/assets/pixel-office/emoji/target_f1.png'), require('@/assets/pixel-office/emoji/target_f2.png'), require('@/assets/pixel-office/emoji/target_f3.png')], // 🎯
  '\uD83D\uDD25': [require('@/assets/pixel-office/emoji/fire_f0.png'), require('@/assets/pixel-office/emoji/fire_f1.png'), require('@/assets/pixel-office/emoji/fire_f2.png'), require('@/assets/pixel-office/emoji/fire_f3.png')], // 🔥
  '\uD83D\uDC8E': [require('@/assets/pixel-office/emoji/diamond_f0.png'), require('@/assets/pixel-office/emoji/diamond_f1.png'), require('@/assets/pixel-office/emoji/diamond_f2.png'), require('@/assets/pixel-office/emoji/diamond_f3.png')], // 💎
  '\uD83E\uDD85': [require('@/assets/pixel-office/emoji/eagle_f0.png'), require('@/assets/pixel-office/emoji/eagle_f1.png'), require('@/assets/pixel-office/emoji/eagle_f2.png'), require('@/assets/pixel-office/emoji/eagle_f3.png')], // 🦅
  '\uD83D\uDC3A': [require('@/assets/pixel-office/emoji/wolf_f0.png'), require('@/assets/pixel-office/emoji/wolf_f1.png'), require('@/assets/pixel-office/emoji/wolf_f2.png'), require('@/assets/pixel-office/emoji/wolf_f3.png')], // 🐺
  '\uD83E\uDD81': [require('@/assets/pixel-office/emoji/lion_f0.png'), require('@/assets/pixel-office/emoji/lion_f1.png'), require('@/assets/pixel-office/emoji/lion_f2.png'), require('@/assets/pixel-office/emoji/lion_f3.png')], // 🦁
  '\u26A1': [require('@/assets/pixel-office/emoji/lightning_f0.png'), require('@/assets/pixel-office/emoji/lightning_f1.png'), require('@/assets/pixel-office/emoji/lightning_f2.png'), require('@/assets/pixel-office/emoji/lightning_f3.png')], // ⚡
  '\uD83D\uDE80': [require('@/assets/pixel-office/emoji/rocket_f0.png'), require('@/assets/pixel-office/emoji/rocket_f1.png'), require('@/assets/pixel-office/emoji/rocket_f2.png'), require('@/assets/pixel-office/emoji/rocket_f3.png')], // 🚀

  // Page 2 — Animals
  '\uD83D\uDC32': [require('@/assets/pixel-office/emoji/dragon_f0.png'), require('@/assets/pixel-office/emoji/dragon_f1.png'), require('@/assets/pixel-office/emoji/dragon_f2.png'), require('@/assets/pixel-office/emoji/dragon_f3.png')], // 🐲
  '\uD83E\uDD88': [require('@/assets/pixel-office/emoji/shark_f0.png'), require('@/assets/pixel-office/emoji/shark_f1.png'), require('@/assets/pixel-office/emoji/shark_f2.png'), require('@/assets/pixel-office/emoji/shark_f3.png')], // 🦈
  '\uD83D\uDC0D': [require('@/assets/pixel-office/emoji/snake_f0.png'), require('@/assets/pixel-office/emoji/snake_f1.png'), require('@/assets/pixel-office/emoji/snake_f2.png'), require('@/assets/pixel-office/emoji/snake_f3.png')], // 🐍
  '\uD83E\uDD89': [require('@/assets/pixel-office/emoji/owl_f0.png'), require('@/assets/pixel-office/emoji/owl_f1.png'), require('@/assets/pixel-office/emoji/owl_f2.png'), require('@/assets/pixel-office/emoji/owl_f3.png')], // 🦉
  '\uD83D\uDC3B': [require('@/assets/pixel-office/emoji/bear_f0.png'), require('@/assets/pixel-office/emoji/bear_f1.png'), require('@/assets/pixel-office/emoji/bear_f2.png'), require('@/assets/pixel-office/emoji/bear_f3.png')], // 🐻
  '\uD83E\uDD8D': [require('@/assets/pixel-office/emoji/gorilla_f0.png'), require('@/assets/pixel-office/emoji/gorilla_f1.png'), require('@/assets/pixel-office/emoji/gorilla_f2.png'), require('@/assets/pixel-office/emoji/gorilla_f3.png')], // 🦍
  '\uD83E\uDD8A': [require('@/assets/pixel-office/emoji/fox_f0.png'), require('@/assets/pixel-office/emoji/fox_f1.png'), require('@/assets/pixel-office/emoji/fox_f2.png'), require('@/assets/pixel-office/emoji/fox_f3.png')], // 🦊
  '\uD83D\uDC1D': [require('@/assets/pixel-office/emoji/bee_f0.png'), require('@/assets/pixel-office/emoji/bee_f1.png'), require('@/assets/pixel-office/emoji/bee_f2.png'), require('@/assets/pixel-office/emoji/bee_f3.png')], // 🐝
  '\uD83E\uDD9C': [require('@/assets/pixel-office/emoji/parrot_f0.png'), require('@/assets/pixel-office/emoji/parrot_f1.png'), require('@/assets/pixel-office/emoji/parrot_f2.png'), require('@/assets/pixel-office/emoji/parrot_f3.png')], // 🦜
  '\uD83E\uDDA2': [require('@/assets/pixel-office/emoji/swan_f0.png'), require('@/assets/pixel-office/emoji/swan_f1.png'), require('@/assets/pixel-office/emoji/swan_f2.png'), require('@/assets/pixel-office/emoji/swan_f3.png')], // 🦢

  // Page 3 — More Animals & Creatures
  '\uD83D\uDC0E': [require('@/assets/pixel-office/emoji/horse_f0.png'), require('@/assets/pixel-office/emoji/horse_f1.png'), require('@/assets/pixel-office/emoji/horse_f2.png'), require('@/assets/pixel-office/emoji/horse_f3.png')], // 🐎
  '\uD83E\uDD84': [require('@/assets/pixel-office/emoji/unicorn_f0.png'), require('@/assets/pixel-office/emoji/unicorn_f1.png'), require('@/assets/pixel-office/emoji/unicorn_f2.png'), require('@/assets/pixel-office/emoji/unicorn_f3.png')], // 🦄
  '\uD83E\uDDAD': [require('@/assets/pixel-office/emoji/seal_f0.png'), require('@/assets/pixel-office/emoji/seal_f1.png'), require('@/assets/pixel-office/emoji/seal_f2.png'), require('@/assets/pixel-office/emoji/seal_f3.png')], // 🦭
  '\uD83D\uDC22': [require('@/assets/pixel-office/emoji/turtle_f0.png'), require('@/assets/pixel-office/emoji/turtle_f1.png'), require('@/assets/pixel-office/emoji/turtle_f2.png'), require('@/assets/pixel-office/emoji/turtle_f3.png')], // 🐢
  '\uD83E\uDD8E': [require('@/assets/pixel-office/emoji/lizard_f0.png'), require('@/assets/pixel-office/emoji/lizard_f1.png'), require('@/assets/pixel-office/emoji/lizard_f2.png'), require('@/assets/pixel-office/emoji/lizard_f3.png')], // 🦎
  '\uD83E\uDD9E': [require('@/assets/pixel-office/emoji/lobster_f0.png'), require('@/assets/pixel-office/emoji/lobster_f1.png'), require('@/assets/pixel-office/emoji/lobster_f2.png'), require('@/assets/pixel-office/emoji/lobster_f3.png')], // 🦞
  '\uD83D\uDC7B': [require('@/assets/pixel-office/emoji/ghost_f0.png'), require('@/assets/pixel-office/emoji/ghost_f1.png'), require('@/assets/pixel-office/emoji/ghost_f2.png'), require('@/assets/pixel-office/emoji/ghost_f3.png')], // 👻
  '\uD83D\uDC80': [require('@/assets/pixel-office/emoji/skull_f0.png'), require('@/assets/pixel-office/emoji/skull_f1.png'), require('@/assets/pixel-office/emoji/skull_f2.png'), require('@/assets/pixel-office/emoji/skull_f3.png')], // 💀
  '\uD83D\uDC7D': [require('@/assets/pixel-office/emoji/alien_f0.png'), require('@/assets/pixel-office/emoji/alien_f1.png'), require('@/assets/pixel-office/emoji/alien_f2.png'), require('@/assets/pixel-office/emoji/alien_f3.png')], // 👽
  // 🦹 superhero — pending generation

  // Page 4 — Power & Sports
  // 💥 explosion — pending generation
  '\uD83C\uDFC6': [require('@/assets/pixel-office/emoji/trophy_f0.png'), require('@/assets/pixel-office/emoji/trophy_f1.png'), require('@/assets/pixel-office/emoji/trophy_f2.png'), require('@/assets/pixel-office/emoji/trophy_f3.png')], // 🏆
  '\uD83D\uDC51': [require('@/assets/pixel-office/emoji/crown_f0.png'), require('@/assets/pixel-office/emoji/crown_f1.png'), require('@/assets/pixel-office/emoji/crown_f2.png'), require('@/assets/pixel-office/emoji/crown_f3.png')], // 👑
  '\uD83C\uDF1F': [require('@/assets/pixel-office/emoji/star_f0.png'), require('@/assets/pixel-office/emoji/star_f1.png'), require('@/assets/pixel-office/emoji/star_f2.png'), require('@/assets/pixel-office/emoji/star_f3.png')], // 🌟
  '\uD83D\uDD2E': [require('@/assets/pixel-office/emoji/crystal_ball_f0.png'), require('@/assets/pixel-office/emoji/crystal_ball_f1.png'), require('@/assets/pixel-office/emoji/crystal_ball_f2.png'), require('@/assets/pixel-office/emoji/crystal_ball_f3.png')], // 🔮
  '\uD83C\uDFB0': [require('@/assets/pixel-office/emoji/slot_machine_f0.png'), require('@/assets/pixel-office/emoji/slot_machine_f1.png'), require('@/assets/pixel-office/emoji/slot_machine_f2.png'), require('@/assets/pixel-office/emoji/slot_machine_f3.png')], // 🎰
  '\uD83C\uDFB2': [require('@/assets/pixel-office/emoji/dice_f0.png'), require('@/assets/pixel-office/emoji/dice_f1.png'), require('@/assets/pixel-office/emoji/dice_f2.png'), require('@/assets/pixel-office/emoji/dice_f3.png')], // 🎲
  '\u265F\uFE0F': [require('@/assets/pixel-office/emoji/chess_f0.png'), require('@/assets/pixel-office/emoji/chess_f1.png'), require('@/assets/pixel-office/emoji/chess_f2.png'), require('@/assets/pixel-office/emoji/chess_f3.png')], // ♟️
  '\uD83C\uDFC0': [require('@/assets/pixel-office/emoji/basketball_f0.png'), require('@/assets/pixel-office/emoji/basketball_f1.png'), require('@/assets/pixel-office/emoji/basketball_f2.png'), require('@/assets/pixel-office/emoji/basketball_f3.png')], // 🏀
  '\uD83C\uDFC8': [require('@/assets/pixel-office/emoji/football_f0.png'), require('@/assets/pixel-office/emoji/football_f1.png'), require('@/assets/pixel-office/emoji/football_f2.png'), require('@/assets/pixel-office/emoji/football_f3.png')], // 🏈

  // Page 5 — Sports & Objects
  '\u26BD': [require('@/assets/pixel-office/emoji/soccer_f0.png'), require('@/assets/pixel-office/emoji/soccer_f1.png'), require('@/assets/pixel-office/emoji/soccer_f2.png'), require('@/assets/pixel-office/emoji/soccer_f3.png')], // ⚽
  '\u26BE': [require('@/assets/pixel-office/emoji/baseball_f0.png'), require('@/assets/pixel-office/emoji/baseball_f1.png'), require('@/assets/pixel-office/emoji/baseball_f2.png'), require('@/assets/pixel-office/emoji/baseball_f3.png')], // ⚾
  '\uD83C\uDFBE': [require('@/assets/pixel-office/emoji/tennis_f0.png'), require('@/assets/pixel-office/emoji/tennis_f1.png'), require('@/assets/pixel-office/emoji/tennis_f2.png'), require('@/assets/pixel-office/emoji/tennis_f3.png')], // 🎾
  '\uD83D\uDCA1': [require('@/assets/pixel-office/emoji/lightbulb_f0.png'), require('@/assets/pixel-office/emoji/lightbulb_f1.png'), require('@/assets/pixel-office/emoji/lightbulb_f2.png'), require('@/assets/pixel-office/emoji/lightbulb_f3.png')], // 💡
  '\uD83D\uDCB0': [require('@/assets/pixel-office/emoji/moneybag_f0.png'), require('@/assets/pixel-office/emoji/moneybag_f1.png'), require('@/assets/pixel-office/emoji/moneybag_f2.png'), require('@/assets/pixel-office/emoji/moneybag_f3.png')], // 💰
  '\uD83D\uDCB8': [require('@/assets/pixel-office/emoji/flying_money_f0.png'), require('@/assets/pixel-office/emoji/flying_money_f1.png'), require('@/assets/pixel-office/emoji/flying_money_f2.png'), require('@/assets/pixel-office/emoji/flying_money_f3.png')], // 💸
  '\uD83D\uDEE1\uFE0F': [require('@/assets/pixel-office/emoji/shield_f0.png'), require('@/assets/pixel-office/emoji/shield_f1.png'), require('@/assets/pixel-office/emoji/shield_f2.png'), require('@/assets/pixel-office/emoji/shield_f3.png')], // 🛡️
  '\uD83D\uDD11': [require('@/assets/pixel-office/emoji/key_f0.png'), require('@/assets/pixel-office/emoji/key_f1.png'), require('@/assets/pixel-office/emoji/key_f2.png'), require('@/assets/pixel-office/emoji/key_f3.png')], // 🔑
  '\uD83C\uDFF9': [require('@/assets/pixel-office/emoji/bow_f0.png'), require('@/assets/pixel-office/emoji/bow_f1.png'), require('@/assets/pixel-office/emoji/bow_f2.png'), require('@/assets/pixel-office/emoji/bow_f3.png')], // 🏹
  '\uD83D\uDCAA': [require('@/assets/pixel-office/emoji/muscle_f0.png'), require('@/assets/pixel-office/emoji/muscle_f1.png'), require('@/assets/pixel-office/emoji/muscle_f2.png'), require('@/assets/pixel-office/emoji/muscle_f3.png')], // 💪

  // Page 6 — Nature & Misc
  '\uD83C\uDF0A': [require('@/assets/pixel-office/emoji/wave_f0.png'), require('@/assets/pixel-office/emoji/wave_f1.png'), require('@/assets/pixel-office/emoji/wave_f2.png'), require('@/assets/pixel-office/emoji/wave_f3.png')], // 🌊
  '\uD83C\uDF0B': [require('@/assets/pixel-office/emoji/volcano_f0.png'), require('@/assets/pixel-office/emoji/volcano_f1.png'), require('@/assets/pixel-office/emoji/volcano_f2.png'), require('@/assets/pixel-office/emoji/volcano_f3.png')], // 🌋
  '\uD83C\uDF29\uFE0F': [require('@/assets/pixel-office/emoji/thunder_f0.png'), require('@/assets/pixel-office/emoji/thunder_f1.png'), require('@/assets/pixel-office/emoji/thunder_f2.png'), require('@/assets/pixel-office/emoji/thunder_f3.png')], // 🌩️
  '\u2744\uFE0F': [require('@/assets/pixel-office/emoji/snowflake_f0.png'), require('@/assets/pixel-office/emoji/snowflake_f1.png'), require('@/assets/pixel-office/emoji/snowflake_f2.png'), require('@/assets/pixel-office/emoji/snowflake_f3.png')], // ❄️
  '\u2604\uFE0F': [require('@/assets/pixel-office/emoji/comet_f0.png'), require('@/assets/pixel-office/emoji/comet_f1.png'), require('@/assets/pixel-office/emoji/comet_f2.png'), require('@/assets/pixel-office/emoji/comet_f3.png')], // ☄️
  '\uD83C\uDF1E': [require('@/assets/pixel-office/emoji/sun_f0.png'), require('@/assets/pixel-office/emoji/sun_f1.png'), require('@/assets/pixel-office/emoji/sun_f2.png'), require('@/assets/pixel-office/emoji/sun_f3.png')], // 🌞
  '\uD83C\uDF19': [require('@/assets/pixel-office/emoji/moon_f0.png'), require('@/assets/pixel-office/emoji/moon_f1.png'), require('@/assets/pixel-office/emoji/moon_f2.png'), require('@/assets/pixel-office/emoji/moon_f3.png')], // 🌙
  '\uD83C\uDF0C': [require('@/assets/pixel-office/emoji/galaxy_f0.png'), require('@/assets/pixel-office/emoji/galaxy_f1.png'), require('@/assets/pixel-office/emoji/galaxy_f2.png'), require('@/assets/pixel-office/emoji/galaxy_f3.png')], // 🌌
  '\uD83E\uDDCA': [require('@/assets/pixel-office/emoji/ice_f0.png'), require('@/assets/pixel-office/emoji/ice_f1.png'), require('@/assets/pixel-office/emoji/ice_f2.png'), require('@/assets/pixel-office/emoji/ice_f3.png')], // 🧊
  '\uD83C\uDF86': [require('@/assets/pixel-office/emoji/fireworks_f0.png'), require('@/assets/pixel-office/emoji/fireworks_f1.png'), require('@/assets/pixel-office/emoji/fireworks_f2.png'), require('@/assets/pixel-office/emoji/fireworks_f3.png')], // 🎆
};

/**
 * Returns true if the given emoji has a pixel art animation available.
 */
export function hasPixelEmoji(emoji: string): boolean {
  return !!PIXEL_EMOJI_FRAMES[emoji];
}

/**
 * Animated pixel emoji component. Cycles through sprite frames.
 * Falls back to text emoji if no pixel version exists.
 */
export const PixelEmojiInline = React.memo(({
  emoji,
  size,
  fps = 4,
  fallbackFontSize,
}: {
  emoji: string;
  size: number;
  fps?: number;
  fallbackFontSize?: number;
}) => {
  const frames = PIXEL_EMOJI_FRAMES[emoji];
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (!frames) return;
    const interval = setInterval(() => {
      setFrameIdx(prev => (prev + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [frames, fps]);

  if (!frames) {
    return <Text style={{ fontSize: fallbackFontSize ?? size * 0.8 }}>{emoji}</Text>;
  }

  return (
    <Image
      source={frames[frameIdx]}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
});
