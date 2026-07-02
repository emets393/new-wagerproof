import XCTest
@testable import WagerproofModels

/// Tests for the pure distribution math behind the Agents "Platform Statistics"
/// screen: the normal fit, share histogram, and curve sampling.
final class DistributionStatisticsTests: XCTestCase {

    // MARK: - fit

    func testFitMeanAndSampleSD() {
        // Known set: mean 5, sample SD (÷ n−1) = √(32/7) ≈ 2.138.
        let fit = DistributionStatistics.fit([2, 4, 4, 4, 5, 5, 7, 9])
        XCTAssertNotNil(fit)
        XCTAssertEqual(fit!.mean, 5, accuracy: 1e-9)
        XCTAssertEqual(fit!.sd, 2.138, accuracy: 0.01)
        XCTAssertEqual(fit!.count, 8)
        XCTAssertFalse(fit!.isEstimated)
    }

    func testFitEmptyIsNil() {
        XCTAssertNil(DistributionStatistics.fit([]))
    }

    func testFitSinglePointHasZeroSD() {
        let fit = DistributionStatistics.fit([0.5])
        XCTAssertEqual(fit?.sd, 0)
        XCTAssertEqual(fit?.mean, 0.5)
    }

    func testFitIgnoresNonFinite() {
        let fit = DistributionStatistics.fit([0.5, .nan, .infinity, 0.5])
        XCTAssertEqual(fit?.count, 2)
        XCTAssertEqual(fit?.mean, 0.5)
    }

    // MARK: - pdf

    func testPdfPeaksAtMean() {
        let fit = NormalFit(mean: 0.5, sd: 0.1, count: 100)
        XCTAssertGreaterThan(fit.pdf(0.5), fit.pdf(0.4))
        XCTAssertGreaterThan(fit.pdf(0.5), fit.pdf(0.6))
        // Standard normal peak height 1/(σ√2π).
        XCTAssertEqual(fit.pdf(0.5), 1.0 / (0.1 * (2 * Double.pi).squareRoot()), accuracy: 1e-9)
    }

    func testPdfZeroForDegenerateFit() {
        let fit = NormalFit(mean: 0.5, sd: 0, count: 1)
        XCTAssertEqual(fit.pdf(0.5), 0)
    }

    func testPdfIntegratesToOne() {
        // Trapezoidal integral of the pdf over a wide domain ≈ 1.
        let fit = NormalFit(mean: 0.5, sd: 0.12, count: 300)
        let lo = -1.0, hi = 2.0
        let steps = 3000
        let dx = (hi - lo) / Double(steps)
        var area = 0.0
        for i in 0..<steps {
            let x0 = lo + Double(i) * dx
            let x1 = x0 + dx
            area += (fit.pdf(x0) + fit.pdf(x1)) / 2 * dx
        }
        XCTAssertEqual(area, 1.0, accuracy: 0.01)
    }

    func testNormalizedDensityPeaksAtOne() {
        let fit = NormalFit(mean: 0.53, sd: 0.08, count: 50)
        XCTAssertEqual(fit.normalizedDensity(at: 0.53), 1.0, accuracy: 1e-9)
        XCTAssertLessThan(fit.normalizedDensity(at: 0.70), 1.0)
    }

    // MARK: - histogram

    func testHistogramSharesSumToOne() {
        let values = [0.1, 0.2, 0.25, 0.4, 0.55, 0.6, 0.62, 0.9]
        let buckets = DistributionStatistics.histogram(values, domain: 0...1, binWidth: 0.1)
        let total = buckets.reduce(0) { $0 + $1.share }
        XCTAssertEqual(total, 1.0, accuracy: 1e-9)
        XCTAssertEqual(buckets.count, 10)
    }

    func testHistogramClampsOutOfDomainIntoEdgeBins() {
        // Values below/above the domain land in the first/last bins (nothing lost).
        let values = [-5.0, 0.05, 50.0]
        let buckets = DistributionStatistics.histogram(values, domain: 0...1, binWidth: 0.5)
        XCTAssertEqual(buckets.count, 2)
        let total = buckets.reduce(0) { $0 + $1.share }
        XCTAssertEqual(total, 1.0, accuracy: 1e-9)
        XCTAssertEqual(buckets.first!.share, 2.0 / 3.0, accuracy: 1e-9)  // -5 and 0.05
        XCTAssertEqual(buckets.last!.share, 1.0 / 3.0, accuracy: 1e-9)   // 50
    }

    func testHistogramEmptyInputs() {
        XCTAssertTrue(DistributionStatistics.histogram([], domain: 0...1, binWidth: 0.1).isEmpty)
        XCTAssertTrue(DistributionStatistics.histogram([0.5], domain: 0...1, binWidth: 0).isEmpty)
    }

    /// The core insight the screen visualizes: raising the min-settled threshold
    /// drops tiny-sample agents, so the 0%/100% spikes vanish and SD tightens.
    func testThresholdRemovesTinySampleSpikes() {
        // 6 well-sampled ~0.5 agents + 4 tiny-sample 0%/100% spikes.
        let solid = Array(repeating: 0.50, count: 6)
        let spikes = [0.0, 1.0, 0.0, 1.0]
        let all = solid + spikes
        let wide = DistributionStatistics.fit(all)!
        let filtered = DistributionStatistics.fit(solid)!
        XCTAssertGreaterThan(wide.sd, filtered.sd)   // spikes inflate spread
        XCTAssertEqual(filtered.sd, 0, accuracy: 1e-9)
    }

    // MARK: - curve sampling

    func testCurvePointsSpanDomain() {
        let fit = NormalFit(mean: 0.5, sd: 0.1, count: 100)
        let pts = DistributionStatistics.curvePoints(fit: fit, domain: 0...1, binWidth: 0.05, samples: 50)
        XCTAssertEqual(pts.count, 50)
        XCTAssertEqual(pts.first!.x, 0, accuracy: 1e-9)
        XCTAssertEqual(pts.last!.x, 1, accuracy: 1e-9)
        // Share-scaled curve height near the mean ≈ pdf·binWidth.
        let peak = pts.max(by: { $0.y < $1.y })!
        XCTAssertEqual(peak.x, 0.5, accuracy: 0.03)
    }
}
