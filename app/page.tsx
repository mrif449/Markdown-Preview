"use client";

import { useState, useEffect } from "react";
import { FileText, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { jsPDF } from "jspdf";
import { marked } from "marked";

const pdfConfig = {
  margin: 50,
  lineHeightMultiplier: 1.2,
  paragraphSpacing: 16,
  fontSize: {
    h1: 24,
    h2: 20,
    h3: 18,
    h4: 16,
    h5: 14,
    h6: 12,
    normal: 12,
    code: 11,
  },
};

const wrapText = (
  doc: jsPDF,
  text: string,
  fontSize: number,
  maxWidth: number,
  fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal"
): string[] => {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", fontStyle);

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = doc.getStringUnitWidth(testLine) * fontSize;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
};

const checkNewPage = (
  doc: jsPDF,
  currentY: number,
  lineHeight: number,
  margin: number
): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + lineHeight > pageHeight - margin) {
    doc.addPage();
    return margin;
  }
  return currentY;
};

const processFormattedText = (text: string) => {
  const parts: { fontStyle: "normal" | "bold" | "italic" | "bolditalic"; text: string }[] = [];
  const regex = /(\*\*|__|\*|_)/g;
  let lastIndex = 0;
  let match;
  let isBold = false;
  let isItalic = false;

  const getFontStyle = () => {
    if (isBold && isItalic) return "bolditalic";
    if (isBold) return "bold";
    if (isItalic) return "italic";
    return "normal";
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        fontStyle: getFontStyle(),
        text: text.slice(lastIndex, match.index),
      });
    }

    const marker = match[1];
    switch (marker) {
      case "**":
      case "__":
        isBold = !isBold;
        break;
      case "*":
      case "_":
        isItalic = !isItalic;
        break;
    }

    lastIndex = match.index + marker.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      fontStyle: getFontStyle(),
      text: text.slice(lastIndex),
    });
  }

  return parts;
};

const generatePdfDocument = (markdown: string): jsPDF => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const maxWidth = doc.internal.pageSize.getWidth() - pdfConfig.margin * 2;
  let y = pdfConfig.margin;

  const renderer = new marked.Renderer();

  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    renderer,
  });

  const tokens = marked.lexer(markdown);

  tokens.forEach((token) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(pdfConfig.fontSize.normal);
    doc.setTextColor(0, 0, 0);

    switch (token.type) {
      case "heading": {
        const headerFontSize =
          pdfConfig.fontSize[`h${token.depth}` as keyof typeof pdfConfig.fontSize] ||
          pdfConfig.fontSize.normal;
        
        const lineHeight = headerFontSize * pdfConfig.lineHeightMultiplier;
        const processedHeader = processFormattedText(token.text);
        
        processedHeader.forEach((textPart) => {
          const wrappedLines = wrapText(
            doc,
            textPart.text,
            headerFontSize,
            maxWidth,
            textPart.fontStyle
          );

          wrappedLines.forEach((lineText) => {
            y = checkNewPage(doc, y, lineHeight, pdfConfig.margin);
            doc.text(lineText, pdfConfig.margin, y);
            y += lineHeight;
          });
        });
        y += pdfConfig.paragraphSpacing;
        break;
      }

      case "paragraph": {
        const fontSize = pdfConfig.fontSize.normal;
        const lineHeight = fontSize * pdfConfig.lineHeightMultiplier;
        const processedText = processFormattedText(token.text);
        
        processedText.forEach((textPart) => {
          const wrappedLines = wrapText(
            doc,
            textPart.text,
            fontSize,
            maxWidth,
            textPart.fontStyle
          );

          wrappedLines.forEach((lineText) => {
            y = checkNewPage(doc, y, lineHeight, pdfConfig.margin);
            doc.text(lineText, pdfConfig.margin, y);
            y += lineHeight;
          });
        });
        y += pdfConfig.paragraphSpacing;
        break;
      }

      case "code": {
        const fontSize = pdfConfig.fontSize.code;
        const lineHeight = fontSize * pdfConfig.lineHeightMultiplier;
        doc.setFont("courier", "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(80, 80, 80);

        const codeLines = token.text.split("\n");
        codeLines.forEach((codeLine) => {
          const wrappedLines = wrapText(doc, codeLine, fontSize, maxWidth);
          wrappedLines.forEach((lineText) => {
            y = checkNewPage(doc, y, lineHeight, pdfConfig.margin);
            doc.text(lineText, pdfConfig.margin, y);
            y += lineHeight;
          });
        });
        y += pdfConfig.paragraphSpacing;
        break;
      }

      case "list": {
        const fontSize = pdfConfig.fontSize.normal;
        const lineHeight = fontSize * pdfConfig.lineHeightMultiplier;
        
        token.items.forEach((item) => {
          const processedItem = processFormattedText(item.text);
          let isFirstLine = true;

          processedItem.forEach((textPart) => {
            const wrappedLines = wrapText(
              doc,
              textPart.text,
              fontSize,
              maxWidth - 20,
              textPart.fontStyle
            );

            wrappedLines.forEach((lineText, i) => {
              y = checkNewPage(doc, y, lineHeight, pdfConfig.margin);
              const prefix = isFirstLine ? "•  " : "   ";
              doc.text(prefix + lineText, pdfConfig.margin, y);
              y += lineHeight;
              isFirstLine = false;
            });
          });
          y += lineHeight * 0.5;
        });
        y += pdfConfig.paragraphSpacing;
        break;
      }

      default:
        break;
    }
  });

  return doc;
};

export default function Home() {
  const [markdown, setMarkdown] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    if (markdown.trim()) {
      const doc = generatePdfDocument(markdown);
      const url = doc.output("bloburl");
      setPreviewUrl(url);
    } else {
      setPreviewUrl("");
    }
  }, [markdown]);

  const handleDownload = () => {
    if (!markdown.trim()) return;
    const doc = generatePdfDocument(markdown);
    doc.save("converted.pdf");
  };

  return (
    <main className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <FileText className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold">Markdown to PDF</h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-col flex-1 p-4 overflow-hidden">
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          <div className="flex flex-col flex-1 min-h-0">
            <label className="text-lg font-medium mb-2">Markdown Input</label>
            <Textarea
              placeholder="# Hello **World**\n\nThis is a **bold** and *italic* text.\n\n- List item 1\n- List item 2\n\n```\ncode block\n```"
              className="flex-1 w-full p-4 text-lg font-mono border border-gray-300 rounded-md resize-none"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
            />
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            <label className="text-lg font-medium mb-2">PDF Preview</label>
            <div className="flex-1 border border-gray-300 rounded-md">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full"
                  title="PDF Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Live preview will appear here...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => setMarkdown("")}
              className="gap-2 px-6 py-3 text-lg"
            >
              <FileDown className="h-5 w-5" />
              Clear
            </Button>
            <Button
              onClick={handleDownload}
              className="gap-2 px-6 py-3 text-lg"
              disabled={!markdown.trim()}
            >
              <Download className="h-5 w-5" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}