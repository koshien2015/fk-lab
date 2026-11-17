/**
 * DOM を組み立てる小さな道具。
 */
type Child = Node | string;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { readonly class?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  const { class: className, ...rest } = props;
  if (className) element.className = className;
  Object.assign(element, rest);
  element.append(...children);
  return element;
}

/** テキストが変わったときだけ書き換える */
export function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
