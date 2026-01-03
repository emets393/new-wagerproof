const {
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Plugin to add WidgetDataBridgeModule native files to the iOS project
function withWidgetDataBridge(config) {
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;

      // Source files
      const sourcePath = path.join(projectRoot, 'modules', 'widget-data-bridge', 'ios');
      const destPath = path.join(platformProjectRoot, 'WagerProof');

      // Copy Swift file
      const swiftSrc = path.join(sourcePath, 'WidgetDataBridgeModule.swift');
      const swiftDest = path.join(destPath, 'WidgetDataBridgeModule.swift');
      if (fs.existsSync(swiftSrc)) {
        fs.copyFileSync(swiftSrc, swiftDest);
        console.log('Copied WidgetDataBridgeModule.swift');
      }

      // Copy Objective-C file
      const mSrc = path.join(sourcePath, 'WidgetDataBridgeModule.m');
      const mDest = path.join(destPath, 'WidgetDataBridgeModule.m');
      if (fs.existsSync(mSrc)) {
        fs.copyFileSync(mSrc, mDest);
        console.log('Copied WidgetDataBridgeModule.m');
      }

      // Update bridging header to import React
      const bridgingHeaderPath = path.join(destPath, 'WagerProof-Bridging-Header.h');
      if (fs.existsSync(bridgingHeaderPath)) {
        let bridgingContent = fs.readFileSync(bridgingHeaderPath, 'utf8');
        const reactImport = '#import <React/RCTBridgeModule.h>';
        if (!bridgingContent.includes(reactImport)) {
          bridgingContent += `\n${reactImport}\n`;
          fs.writeFileSync(bridgingHeaderPath, bridgingContent);
          console.log('Updated bridging header with React import');
        }
      }

      return config;
    },
  ]);

  // Add files to Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const targetName = 'WagerProof';

    // Find the main group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;

    // Get the target's source build phase
    const target = xcodeProject.getFirstTarget();
    if (!target) {
      console.warn('Could not find main target');
      return config;
    }

    // Add the files if they don't already exist
    const files = [
      'WidgetDataBridgeModule.swift',
      'WidgetDataBridgeModule.m',
    ];

    for (const fileName of files) {
      const filePath = `${targetName}/${fileName}`;

      // Check if file already exists in project
      const fileExists = Object.values(xcodeProject.pbxFileReferenceSection())
        .some(ref => ref && ref.path === fileName);

      if (!fileExists) {
        try {
          xcodeProject.addSourceFile(
            filePath,
            { target: target.uuid },
            mainGroup
          );
          console.log(`Added ${fileName} to Xcode project`);
        } catch (error) {
          console.log(`File ${fileName} may already exist or error: ${error.message}`);
        }
      }
    }

    return config;
  });

  return config;
}

module.exports = withWidgetDataBridge;
