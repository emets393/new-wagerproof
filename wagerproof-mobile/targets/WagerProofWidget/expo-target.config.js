/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "WagerProofWidget",
  bundleIdentifier: "com.wagerproof.mobile.widget",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.wagerproof.mobile"]
  }
};
