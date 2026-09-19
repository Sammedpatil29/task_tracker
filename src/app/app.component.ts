import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IonApp } from '@ionic/angular';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'task_tracker';

  constructor(private themeService: ThemeService) {}
}
