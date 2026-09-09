import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.css'
})
export class LoaderComponent {
  @Input() message: string = 'Loading your discipline data...';
  @Input() subMessage: string = 'Cultivating consistency and focus';
  @Input() fullScreen: boolean = false;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
}

