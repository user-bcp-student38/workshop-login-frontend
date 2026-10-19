import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import merge from 'lodash/merge';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username: any = '';
  password: any = '';
  busy: any = false;
  message: string = '';
  preferences: any = { theme: 'light', showTips: true, compact: false };

  constructor(private router: Router) {
    try {
      const saved = JSON.parse(localStorage.getItem('workshop_preferences') || '{}');
      this.preferences = merge(this.preferences, saved);
    } catch (error) {
      console.log('Preferences could not be loaded', error);
    }
  }

  async login(): Promise<void> {
    this.message = '';
    if (this.username === null || this.username === undefined || String(this.username).trim() === '') {
      this.message = 'Ingrese un usuario.';
    } else {
      if (this.password === null || this.password === undefined || String(this.password).trim() === '') {
        this.message = 'Ingrese una contraseña.';
      } else {
        this.busy = true;
        try {
          const response: any = await axios.post(
            'http://localhost:8080/auth/login',
            { username: this.username, password: this.password, client: 'angular-workshop' },
            { timeout: 5000 }
          );
          if (response && response.data && response.data.token) {
            localStorage.setItem('workshop_token', response.data.token);
            localStorage.setItem('workshop_user', JSON.stringify(response.data.user));
            localStorage.setItem('workshop_preferences', JSON.stringify(this.preferences));
            await this.router.navigate(['/dashboard']);
          } else {
            this.message = 'El backend respondió sin token.';
          }
        } catch (error: any) {
          this.message = 'No se pudo iniciar sesión. Verifica tus credenciales o inténtalo nuevamente.';
          console.error(error);
        } finally {
          this.busy = false;
        }
      }
    }
  }
}
