import Foundation
import AVFoundation

/// Native module to override iOS audio output to the loudspeaker.
/// Needed because WebRTC's PlayAndRecord category defaults to earpiece.
@objc(AudioRouteModule)
class AudioRouteModule: NSObject {

  @objc
  func forceToSpeaker(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      try AVAudioSession.sharedInstance().overrideOutputAudioPort(.speaker)
      resolve(true)
    } catch {
      reject("AUDIO_ROUTE_ERROR", "Failed to override output to speaker: \(error.localizedDescription)", error)
    }
  }

  @objc
  func resetRoute(_ resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      try AVAudioSession.sharedInstance().overrideOutputAudioPort(.none)
      resolve(true)
    } catch {
      reject("AUDIO_ROUTE_ERROR", "Failed to reset audio route: \(error.localizedDescription)", error)
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
