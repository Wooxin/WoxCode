import { useMemo } from "react";
import { marked } from "marked";

interface MarkdownPreviewProps {
  content: string;
}

// Configure marked for safe rendering
marked.setOptions({ breaks: true, gfm: true });

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    try {
      return marked.parse(content) as string;
    } catch {
      return "<p>渲染错误</p>";
    }
  }, [content]);

  if (!content) {
    return <div className="md-preview-empty">预览区域</div>;
  }

  return (
    <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
