#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AudioRouteModule, NSObject)

RCT_EXTERN_METHOD(forceToSpeaker:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resetRoute:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
