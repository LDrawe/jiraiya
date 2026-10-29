import React from 'react';
import type { Root, Content, PhrasingContent, TableCell } from 'mdast';

interface MarkdownViewProps {
  ast: Root;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ ast }) => {
  if (ast.children.length === 0) {
    return null;
  }

  return (
    <div className="markdown-body">
      {ast.children.map((node, i) => renderBlockNode(node, i))}
    </div>
  );
};

function renderBlockNode(node: Content, key: number): React.ReactNode {
  switch (node.type) {
    case 'heading': {
      const children = node.children.map((c, i) => renderInlineNode(c, i));
      if (node.depth === 1) return <h4 key={key}>{children}</h4>;
      if (node.depth === 2) return <h5 key={key}>{children}</h5>;
      return <h6 key={key}>{children}</h6>;
    }
    case 'paragraph':
      return <p key={key}>{node.children.map((c, i) => renderInlineNode(c, i))}</p>;
    case 'list': {
      const ListTag = node.ordered ? 'ol' : 'ul';
      return (
        <ListTag key={key} className="markdown-list">
          {node.children.map((item, i) => (
            <li key={i}>
              {typeof item.checked === 'boolean' && (
                <>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    readOnly
                    disabled
                    aria-label={item.checked ? 'Completed' : 'Pending'}
                  />{' '}
                </>
              )}
              {item.children.map((child, ci) =>
                child.type === 'paragraph'
                  ? child.children.map((inline, ii) => renderInlineNode(inline, ii))
                  : renderBlockNode(child, ci)
              )}
            </li>
          ))}
        </ListTag>
      );
    }
    case 'code':
      return (
        <pre key={key} className="code-block">
          <code>{node.value}</code>
        </pre>
      );
    case 'blockquote':
      return (
        <blockquote key={key} className="markdown-quote">
          {node.children.map((c, i) => renderBlockNode(c, i))}
        </blockquote>
      );
    case 'table': {
      const [headerRow, ...bodyRows] = node.children;
      return (
        <div key={key} className="markdown-table-wrap">
          <table className="markdown-table">
            {headerRow && (
              <thead>
                <tr>
                  {headerRow.children.map((cell: TableCell, ci: number) => (
                    <th key={ci}>{cell.children.map((c, ii) => renderInlineNode(c, ii))}</th>
                  ))}
                </tr>
              </thead>
            )}
            {bodyRows.length > 0 && (
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.children.map((cell: TableCell, ci: number) => (
                      <td key={ci}>{cell.children.map((c, ii) => renderInlineNode(c, ii))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      );
    }
    case 'thematicBreak':
      return <hr key={key} />;
    default:
      return null;
  }
}

function renderInlineNode(node: PhrasingContent, key: number): React.ReactNode {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'strong':
      return <strong key={key}>{node.children.map((c, i) => renderInlineNode(c, i))}</strong>;
    case 'emphasis':
      return <em key={key}>{node.children.map((c, i) => renderInlineNode(c, i))}</em>;
    case 'delete':
      return <del key={key}>{node.children.map((c, i) => renderInlineNode(c, i))}</del>;
    case 'inlineCode':
      return (
        <code key={key} className="inline-code">
          {node.value}
        </code>
      );
    case 'link': {
      const safeHref = /^https?:\/\//i.test(node.url) ? node.url : '#';
      return (
        <a key={key} href={safeHref} target="_blank" rel="noopener noreferrer" className="link">
          {node.children.map((c, i) => renderInlineNode(c, i))}
        </a>
      );
    }
    default:
      return null;
  }
}
