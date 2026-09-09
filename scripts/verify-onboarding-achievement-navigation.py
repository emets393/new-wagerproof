"""Exercise the production Step enum without the store's network/UI dependencies."""
from pathlib import Path
import subprocess,tempfile
repo=Path(__file__).resolve().parents[1]
source=(repo/'wagerproof-ios-native/WagerproofKit/Sources/WagerproofStores/OnboardingStore.swift').read_text()
start=source.index('    public enum Step:')
end=source.index('    public enum BettorType:',start)
checks='''
let flow = OnboardingStore.Step.allCases
precondition(flow.count == 26)
precondition(Set(flow.map(\\.rawValue)).count == 26)
precondition(OnboardingStore.Step.agentLeaderboard.next == .achievements)
precondition(OnboardingStore.Step.achievements.next == .attPriming)
precondition(OnboardingStore.Step.attPriming.previous == .achievements)
precondition(OnboardingStore.Step.achievements.previous == .agentLeaderboard)
precondition(OnboardingStore.Step.achievements.rawValue == 26)
precondition(OnboardingStore.Step.builderIdentity.rawValue == 22)
precondition(OnboardingStore.Step.generation.rawValue == 23)
precondition(OnboardingStore.Step.timeSummary.rawValue == 25)
precondition(OnboardingStore.Step.carouselPageCount == 23)
precondition(OnboardingStore.Step.achievements.carouselIndex == 13)
precondition(OnboardingStore.Step.builderIdentity.progress == 1)
precondition(OnboardingStore.Step.generation.carouselIndex == nil)
precondition(OnboardingStore.Step.achievements.analyticsStepNumber == nil)
precondition(flow.compactMap(\\.analyticsStepNumber) == Array(1...24))
for (index, step) in flow.enumerated() {
    precondition(step.previous == (index > 0 ? flow[index-1] : nil))
    precondition(step.next == (index+1 < flow.count ? flow[index+1] : nil))
    if let slot = step.carouselIndex { precondition(OnboardingStore.Step.carouselSteps[slot] == step) }
    if index+1 < flow.count { precondition(step < flow[index+1]) }
}
print("PASS: onboarding insertion, forward/back navigation, stable IDs, carousel progress and legacy analytics")
'''
with tempfile.TemporaryDirectory(prefix='wagerproof-onboarding-navigation-') as directory:
 p=Path(directory)/'main.swift';p.write_text('import Foundation\nenum OnboardingStore {\n'+source[start:end]+'\n}\n'+checks)
 subprocess.run(['swift','-module-cache-path',str(Path(directory)/'cache'),str(p)],check=True)
