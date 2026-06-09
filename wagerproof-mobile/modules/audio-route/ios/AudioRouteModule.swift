import Foundation
import AVFoundation

/// Native module to override iOS audio output to the loudspeaker.
/// Needed because WebRTC's PlayAndRecord category defaults to earpiece.
@objc(AudioRouteModule)
class AudioRouteModule: NSObject {
  private var observersRegistered = false
  private var speakerLockEnabled = false
  private var isApplyingSpeakerRoute = false

  @objc
  func forceToSpeaker(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      do {
        self.speakerLockEnabled = true
        self.registerObserversIfNeeded()
        try self.applySpeakerRouteIfNeeded()
        resolve(true)
      } catch {
        reject("AUDIO_ROUTE_ERROR", "Failed to force speaker output: \(error.localizedDescription)", error)
      }
    }
  }

  @objc
  func resetRoute(_ resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      do {
        self.speakerLockEnabled = false
        self.removeObserversIfNeeded()
        try self.clearSpeakerRoutePreference()
        resolve(true)
      } catch {
        reject("AUDIO_ROUTE_ERROR", "Failed to reset audio route: \(error.localizedDescription)", error)
      }
    }
  }

  @objc
  func getRouteDebugInfo(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let session = AVAudioSession.sharedInstance()
      let outputs = session.currentRoute.outputs.map(Self.serializePort)
      let inputs = session.currentRoute.inputs.map(Self.serializePort)

      resolve([
        "category": session.category.rawValue,
        "mode": session.mode.rawValue,
        "categoryOptions": Self.describeCategoryOptions(session.categoryOptions),
        "outputs": outputs,
        "inputs": inputs,
        "speakerLockEnabled": self.speakerLockEnabled,
        "speakerPreferred": session.categoryOptions.contains(.defaultToSpeaker),
        "isSpeakerOutput": session.currentRoute.outputs.contains(where: { $0.portType == .builtInSpeaker }),
      ])
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  deinit {
    removeObserversIfNeeded()
  }

  private func applySpeakerRouteIfNeeded() throws {
    let session = AVAudioSession.sharedInstance()
    let currentOptions = session.categoryOptions
    var desiredOptions = currentOptions
    desiredOptions.insert(.defaultToSpeaker)

    let needsCategoryUpdate = session.category != .playAndRecord || desiredOptions != currentOptions
    let isSpeakerOutput = session.currentRoute.outputs.contains(where: { $0.portType == .builtInSpeaker })
    let needsOutputOverride = !isSpeakerOutput

    guard needsCategoryUpdate || needsOutputOverride else {
      return
    }

    // Preserve the active voice-processing mode and existing options. We only
    // add the speaker preference to avoid clobbering WebRTC's audio tuning.
    isApplyingSpeakerRoute = true
    defer { isApplyingSpeakerRoute = false }

    if needsCategoryUpdate {
      try session.setCategory(.playAndRecord, mode: session.mode, options: desiredOptions)
    }
    try session.setActive(true)
    if needsOutputOverride {
      try session.overrideOutputAudioPort(.speaker)
    }
  }

  private func clearSpeakerRoutePreference() throws {
    let session = AVAudioSession.sharedInstance()

    if session.category == .playAndRecord {
      var options = session.categoryOptions
      options.remove(.defaultToSpeaker)
      try session.setCategory(.playAndRecord, mode: session.mode, options: options)
    }

    try session.overrideOutputAudioPort(.none)
  }

  private func registerObserversIfNeeded() {
    guard !observersRegistered else { return }

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleRouteChange),
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInterruption),
      name: AVAudioSession.interruptionNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleMediaServicesReset),
      name: AVAudioSession.mediaServicesWereResetNotification,
      object: nil
    )

    observersRegistered = true
  }

  private func removeObserversIfNeeded() {
    guard observersRegistered else { return }
    NotificationCenter.default.removeObserver(self)
    observersRegistered = false
  }

  @objc
  private func handleRouteChange(_ notification: Notification) {
    guard !isApplyingSpeakerRoute else { return }

    if
      let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
      let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue),
      reason == .override
    {
      return
    }

    reapplySpeakerRoute(reason: "route change")
  }

  @objc
  private func handleInterruption(_ notification: Notification) {
    guard speakerLockEnabled else { return }

    guard
      let typeValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: typeValue),
      type == .ended
    else {
      return
    }

    reapplySpeakerRoute(reason: "interruption ended")
  }

  @objc
  private func handleMediaServicesReset(_ notification: Notification) {
    reapplySpeakerRoute(reason: "media services reset")
  }

  private func reapplySpeakerRoute(reason: String) {
    guard speakerLockEnabled else { return }

    do {
      try applySpeakerRouteIfNeeded()
    } catch {
      NSLog("[AudioRouteModule] Failed to reapply speaker route after %@: %@", reason, error.localizedDescription)
    }
  }

  private static func serializePort(_ port: AVAudioSessionPortDescription) -> [String: String] {
    [
      "portType": port.portType.rawValue,
      "portName": port.portName,
    ]
  }

  private static func describeCategoryOptions(_ options: AVAudioSession.CategoryOptions) -> [String] {
    let knownOptions: [(AVAudioSession.CategoryOptions, String)] = [
      (.mixWithOthers, "mixWithOthers"),
      (.duckOthers, "duckOthers"),
      (.allowBluetoothHFP, "allowBluetoothHFP"),
      (.defaultToSpeaker, "defaultToSpeaker"),
      (.interruptSpokenAudioAndMixWithOthers, "interruptSpokenAudioAndMixWithOthers"),
      (.allowBluetoothA2DP, "allowBluetoothA2DP"),
      (.allowAirPlay, "allowAirPlay"),
      (.overrideMutedMicrophoneInterruption, "overrideMutedMicrophoneInterruption"),
    ]

    return knownOptions.compactMap { option, name in
      options.contains(option) ? name : nil
    }
  }
}
