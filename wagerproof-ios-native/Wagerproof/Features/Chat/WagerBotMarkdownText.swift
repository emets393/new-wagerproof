import SwiftUI
import WagerproofDesign

/// Lightweight markdown renderer for the WagerBot assistant bubble.
/// Direct port of Honeydew's `ChatV3MarkdownText` — same block parser,
/// same inline `AttributedString(markdown:)` strategy.
///
/// SwiftUI's built-in `Text(LocalizedStringKey(...))` /
/// `AttributedString(markdown:)` supports inline markdown — **bold**,
/// *italic*, `code`, [links](url) — but collapses structural markdown
/// (paragraphs, lists, headings). This view splits the input into
/// *blocks* and renders each with the appropriate SwiftUI layout, using
/// `AttributedString` per-line for inline formatting.
///
/// Supported:
///   • Paragraphs (blank-line separated)
///   • Bulleted lists (`-`, `*`, `•`)
///   • Numbered lists (`1.` / `1)` etc.)
///   • Headings (`#`, `##`, `###`)
///   • Blockquotes (`> ...`)
///   • Inline: bold / italic / code / links via AttributedString
struct WagerBotMarkdownText: View {
    let text: String
    let baseFont: Font
    let primaryColor: Color
    let secondaryColor: Color
    /// When set, blockquotes render with this accent (tinted background +
    /// colored bar) instead of the chat-gray default — the regression
    /// report's AI summary uses its purple (RN-parity blockquote chrome).
    let quoteAccent: Color?

    init(
        _ text: String,
        baseFont: Font = .system(size: 15, weight: .regular),
        primaryColor: Color = .appTextPrimary,
        secondaryColor: Color = .appTextSecondary,
        quoteAccent: Color? = nil
    ) {
        self.text = text
        self.baseFont = baseFont
        self.primaryColor = primaryColor
        self.secondaryColor = secondaryColor
        self.quoteAccent = quoteAccent
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(parsedBlocks().enumerated()), id: \.offset) { _, block in
                render(block)
            }
        }
    }

    // MARK: - Block parser

    private enum Block {
        case paragraph(String)
        case heading(level: Int, text: String)
        case bulletList([String])
        case numberedList([String])
        case quote(String)
    }

    private func parsedBlocks() -> [Block] {
        var blocks: [Block] = []
        var paragraphBuffer: [String] = []
        var bulletBuffer: [String] = []
        var numberBuffer: [String] = []

        func flushParagraph() {
            guard !paragraphBuffer.isEmpty else { return }
            let joined = paragraphBuffer.joined(separator: "\n")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !joined.isEmpty { blocks.append(.paragraph(joined)) }
            paragraphBuffer.removeAll()
        }
        func flushBullets() {
            guard !bulletBuffer.isEmpty else { return }
            blocks.append(.bulletList(bulletBuffer))
            bulletBuffer.removeAll()
        }
        func flushNumbers() {
            guard !numberBuffer.isEmpty else { return }
            blocks.append(.numberedList(numberBuffer))
            numberBuffer.removeAll()
        }
        func flushAll() { flushParagraph(); flushBullets(); flushNumbers() }

        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { flushAll(); continue }
            if let head = parseHeading(trimmed) {
                flushAll()
                blocks.append(.heading(level: head.level, text: head.text))
                continue
            }
            if let bulletContent = parseBullet(trimmed) {
                flushParagraph(); flushNumbers()
                bulletBuffer.append(bulletContent)
                continue
            }
            if let numberContent = parseNumbered(trimmed) {
                flushParagraph(); flushBullets()
                numberBuffer.append(numberContent)
                continue
            }
            if trimmed.hasPrefix(">") {
                flushAll()
                let body = String(trimmed.dropFirst()).trimmingCharacters(in: .whitespaces)
                blocks.append(.quote(body))
                continue
            }
            flushBullets(); flushNumbers()
            paragraphBuffer.append(trimmed)
        }
        flushAll()
        return blocks
    }

    private func parseHeading(_ s: String) -> (level: Int, text: String)? {
        var level = 0
        for ch in s {
            if ch == "#" { level += 1 } else { break }
            if level > 6 { return nil }
        }
        guard level >= 1, s.count > level,
              s[s.index(s.startIndex, offsetBy: level)] == " "
        else { return nil }
        let body = String(s.dropFirst(level)).trimmingCharacters(in: .whitespaces)
        return (level, body)
    }

    private func parseBullet(_ s: String) -> String? {
        for prefix in ["- ", "* ", "• "] {
            if s.hasPrefix(prefix) { return String(s.dropFirst(prefix.count)) }
        }
        return nil
    }

    private func parseNumbered(_ s: String) -> String? {
        var idx = s.startIndex
        var digitCount = 0
        while idx < s.endIndex, s[idx].isNumber {
            digitCount += 1
            idx = s.index(after: idx)
        }
        guard digitCount > 0, idx < s.endIndex else { return nil }
        let marker = s[idx]
        guard marker == "." || marker == ")" else { return nil }
        let afterMarker = s.index(after: idx)
        guard afterMarker < s.endIndex, s[afterMarker] == " " else { return nil }
        return String(s[s.index(after: afterMarker)...])
    }

    // MARK: - Rendering

    @ViewBuilder
    private func render(_ block: Block) -> some View {
        switch block {
        case .paragraph(let body):
            inlineText(body, font: baseFont, color: primaryColor)

        case .heading(let level, let body):
            // Step font size up for h1/h2/h3; h4+ collapse to body-bold
            // so we don't dwarf the rest of the bubble.
            let size: CGFloat = {
                switch level {
                case 1: return 19
                case 2: return 17
                default: return 16
                }
            }()
            inlineText(
                body,
                font: .system(size: size, weight: .bold),
                color: primaryColor
            )
            .padding(.top, 2)

        case .bulletList(let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•")
                            .font(baseFont)
                            .foregroundStyle(secondaryColor)
                            .frame(width: 10, alignment: .leading)
                        inlineText(item, font: baseFont, color: primaryColor)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }

        case .numberedList(let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { idx, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(idx + 1).")
                            .font(baseFont.monospacedDigit())
                            .foregroundStyle(secondaryColor)
                            .frame(width: 22, alignment: .trailing)
                        inlineText(item, font: baseFont, color: primaryColor)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }

        case .quote(let body):
            if let accent = quoteAccent {
                HStack(alignment: .top, spacing: 8) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(accent)
                        .frame(width: 3)
                    inlineText(body, font: baseFont.italic(), color: primaryColor)
                        .padding(.vertical, 2)
                }
                .padding(8)
                .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 6))
            } else {
                HStack(alignment: .top, spacing: 8) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(secondaryColor.opacity(0.4))
                        .frame(width: 3)
                    inlineText(body, font: baseFont.italic(), color: secondaryColor)
                        .padding(.vertical, 2)
                }
            }
        }
    }

    private func inlineText(_ s: String, font: Font, color: Color) -> Text {
        let attributed: AttributedString = {
            if let a = try? AttributedString(
                markdown: s,
                options: AttributedString.MarkdownParsingOptions(
                    interpretedSyntax: .inlineOnlyPreservingWhitespace
                )
            ) {
                return a
            }
            return AttributedString(s)
        }()
        return Text(attributed)
            .font(font)
            .foregroundStyle(color)
    }
}

#Preview {
    ScrollView {
        WagerBotMarkdownText(
            """
            Here are **the top value plays** today.

            - Lakers -3.5 — model edges Vegas by 1.8 points
            - *Yankees ML* at +145 — fair value sits around +110
            - Chiefs/Bills under 51.5

            > Tip: Polymarket is showing the under at 53%.

            ## Why these stand out

            1. Strong model edge vs market consensus
            2. Cross-source agreement across model + public sentiment
            """
        )
        .padding()
    }
}
