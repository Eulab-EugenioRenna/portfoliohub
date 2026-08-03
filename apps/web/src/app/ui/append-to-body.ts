import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, Input, inject, OnDestroy } from '@angular/core';

type OverlayAlignment = 'start' | 'end';

@Directive({ selector: '[phAppendToBody]' })
export class AppendToBody implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly element = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly cleanups: Array<() => void> = [];

  @Input() phAppendToBodyAnchor: HTMLElement | null = null;
  @Input() phAppendToBodyAlign: OverlayAlignment = 'end';
  @Input() phAppendToBodyMatchWidth = false;
  @Input() phAppendToBodyGap = 10;

  ngAfterViewInit(): void {
    this.element.dataset.bodyOverlay = '';
    this.document.body.appendChild(this.element);
    if (!this.phAppendToBodyAnchor) return;

    const view = this.document.defaultView;
    if (!view) return;
    const reposition = () => this.positionAtAnchor();
    view.addEventListener('resize', reposition);
    this.document.addEventListener('scroll', reposition, true);
    this.cleanups.push(
      () => view.removeEventListener('resize', reposition),
      () => this.document.removeEventListener('scroll', reposition, true),
    );
    this.positionAtAnchor();
  }

  ngOnDestroy(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.element.remove();
  }

  private positionAtAnchor(): void {
    const anchor = this.phAppendToBodyAnchor;
    const view = this.document.defaultView;
    if (!anchor || !view) return;

    const margin = 12;
    const anchorRect = anchor.getBoundingClientRect();
    this.element.style.position = 'fixed';
    this.element.style.inset = 'auto';
    this.element.style.top = '0';
    this.element.style.left = '0';
    this.element.style.right = 'auto';
    if (this.phAppendToBodyMatchWidth) {
      this.element.style.width = `${Math.max(anchorRect.width, 1)}px`;
      this.element.style.overflowY = 'auto';
    }

    const panelRect = this.element.getBoundingClientRect();
    const panelWidth = panelRect.width || anchorRect.width;
    const panelHeight = panelRect.height;
    const preferredLeft =
      this.phAppendToBodyAlign === 'start' ? anchorRect.left : anchorRect.right - panelWidth;
    const left = Math.min(
      Math.max(preferredLeft, margin),
      Math.max(margin, view.innerWidth - panelWidth - margin),
    );
    const below = anchorRect.bottom + this.phAppendToBodyGap;
    const spaceBelow = view.innerHeight - margin - below;
    const spaceAbove = anchorRect.top - this.phAppendToBodyGap - margin;
    const openBelow = panelHeight <= spaceBelow || spaceBelow >= spaceAbove;
    const availableHeight = Math.max(80, Math.floor(openBelow ? spaceBelow : spaceAbove));
    const top = openBelow
      ? below
      : Math.max(
          margin,
          anchorRect.top - this.phAppendToBodyGap - Math.min(panelHeight, availableHeight),
        );

    this.element.style.left = `${Math.round(left)}px`;
    this.element.style.top = `${Math.round(Math.max(margin, top))}px`;
    this.element.style.maxHeight = `${availableHeight}px`;
  }
}
