import { AfterViewInit, Directive, ElementRef, OnDestroy } from '@angular/core';

/** Fades an element up the first time it scrolls into view (see .reveal in styles.css). */
@Directive({ selector: '[appReveal]', standalone: true, host: { class: 'reveal' } })
export class RevealDirective implements AfterViewInit, OnDestroy {
  private observer?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      this.el.nativeElement.classList.add('is-visible');
      this.observer?.disconnect();
    }, { threshold: 0.12 });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
