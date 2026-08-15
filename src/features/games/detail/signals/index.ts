/**
 * Pick-signal surfaces shared by the game-detail sections: the pill row on a
 * market card and the backtest chart in its expanded detail.
 *
 * Cross-platform siblings — keep the maths in step:
 *   iOS     `Wagerproof/Features/GameWidgets/{PickSignalPills,SignalBacktestChart}.swift`
 *   Android `core/design/components/{PickSignalPills,SignalBacktestChart}.kt`
 */
export { PickSignalsSection, type PickSignalPillModel } from './PickSignalsSection';
export {
  SignalBacktestChart,
  SignalHitRateMeter,
  SignalRecordBar,
  type SignalPerformanceLike,
} from './SignalBacktestChart';
export { BREAK_EVEN_RATE, hitRateFraction, hitRateWindow, parseHitRate } from './hitRate';
