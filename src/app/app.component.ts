import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IonApp } from '@ionic/angular';
import { ThemeService } from '../services/theme.service';
import { OtaService } from '../services/ota.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'task_tracker';

  constructor(
    private themeService: ThemeService,
    private otaService: OtaService
  ) {}

  ngOnInit() {
    this.otaService.initialize();
  }
}
