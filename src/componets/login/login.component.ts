import { Component, EventEmitter, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { ModalService } from '../../services/modal.service';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, ModalComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  @Output() isLoggedIn: EventEmitter<boolean> = new EventEmitter<boolean>();
  mode: 'login' | 'signup' | 'forgot' = 'login';

  // Login credentials
  loginEmail = '';
  loginPassword = '';

  // Signup fields
  name = '';
  email = '';
  password = '';
  userEmoji = '🌱';

  // Signup OTP Verification state
  otpStep = false;
  otpCode = '';
  resendCooldown = 0;
  private cooldownTimer: any = null;

  // Forgot Password state
  forgotEmail = '';
  resetOtpCode = '';
  newPassword = '';
  forgotOtpStep = false;
  forgotCooldown = 0;
  private forgotCooldownTimer: any = null;

  showPassword = false;
  showNewPassword = false;
  loading = false;
  isResending = false;

  emoji = '✨';

  private emojis = ['🔥', '🚀', '😎', '💪', '✨', '🧠', '🎯', '⚡', '👑', '🌱', '🏆'];
  private emojisSignup = [
    '😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😌', '😍', '😘',
    '😎', '🤓', '😇', '🤗', '😏', '😋', '🤩', '🥳', '😺',
    '😴', '🤤', '😛', '😜', '🤪', '😝',
    '😐', '😑', '😶', '🙄', '😬', '🤐',
    '🤔', '🫡', '🤨', '🦁', '🐺', '🦊', '🦅', '💎'
  ];

  constructor(
    private router: Router,
    private taskTrackerService: TaskTrackerService,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    this.emoji = this.emojis[Math.floor(Math.random() * this.emojis.length)];
    this.userEmoji = this.emojisSignup[Math.floor(Math.random() * this.emojisSignup.length)];
  }

  ngOnDestroy() {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    if (this.forgotCooldownTimer) clearInterval(this.forgotCooldownTimer);
  }

  toggleMode(targetMode?: 'login' | 'signup' | 'forgot') {
    if (targetMode) {
      this.mode = targetMode;
    } else {
      this.mode = this.mode === 'login' ? 'signup' : 'login';
    }
    this.emoji = this.emojis[Math.floor(Math.random() * this.emojis.length)];
    this.otpStep = false;
    this.otpCode = '';
    this.forgotOtpStep = false;
    this.resetOtpCode = '';
    this.newPassword = '';
    this.loading = false;
  }

  changeEmoji() {
    this.userEmoji = this.emojisSignup[Math.floor(Math.random() * this.emojisSignup.length)];
  }

  backToEdit() {
    this.otpStep = false;
    this.otpCode = '';
  }

  backToForgotEmail() {
    this.forgotOtpStep = false;
    this.resetOtpCode = '';
  }

  startCooldown(seconds: number = 45) {
    this.resendCooldown = seconds;
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
    }, 1000);
  }

  startForgotCooldown(seconds: number = 45) {
    this.forgotCooldown = seconds;
    if (this.forgotCooldownTimer) clearInterval(this.forgotCooldownTimer);
    this.forgotCooldownTimer = setInterval(() => {
      this.forgotCooldown--;
      if (this.forgotCooldown <= 0) {
        clearInterval(this.forgotCooldownTimer);
        this.forgotCooldownTimer = null;
      }
    }, 1000);
  }

  submit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (this.mode === 'login') {
      const email = this.loginEmail?.trim();
      const password = this.loginPassword;

      if (!email || !emailRegex.test(email)) {
        this.modalService.alert('Invalid Email', 'Please provide a valid email address.');
        return;
      }
      if (!password || password.length < 6) {
        this.modalService.alert('Invalid Password', 'Password must be at least 6 characters.');
        return;
      }

      this.loading = true;
      const loginData = { email, password };
      this.taskTrackerService.loginUser(loginData).subscribe({
        next: (response: any) => {
          sessionStorage.setItem('trackJwt', response['token']);
          this.isLoggedIn.emit(true);
          this.loading = false;
          this.router.navigate(['/home']);
        },
        error: (err: any) => {
          this.loading = false;
          this.modalService.alert('Sign In Failed', err?.error?.error || 'Invalid credentials. Please try again.');
        }
      });
    } else if (this.mode === 'signup') {
      // Step 1 of Signup: Request OTP via Nodemailer
      const name = this.name?.trim();
      const email = this.email?.trim();
      const password = this.password;

      if (!name || name.length < 2) {
        this.modalService.alert('Invalid Name', 'Full name must be at least 2 characters.');
        return;
      }
      if (!email || !emailRegex.test(email)) {
        this.modalService.alert('Invalid Email', 'Please provide a valid email address.');
        return;
      }
      if (!password || password.length < 6) {
        this.modalService.alert('Weak Password', 'Password must be at least 6 characters long.');
        return;
      }

      this.loading = true;
      const payload = { name, email, password };
      this.taskTrackerService.sendOtp(payload).subscribe({
        next: () => {
          this.loading = false;
          this.otpStep = true;
          this.startCooldown(45);
        },
        error: (err: any) => {
          this.loading = false;
          this.modalService.alert('Verification Error', err?.error?.error || 'Could not send verification email. Please try again.');
        }
      });
    }
  }

  resendOtpCode() {
    if (this.resendCooldown > 0 || this.isResending) return;

    this.isResending = true;
    this.taskTrackerService.resendOtp({ email: this.email.trim(), name: this.name.trim() }).subscribe({
      next: () => {
        this.isResending = false;
        this.startCooldown(45);
        this.modalService.alert('Code Sent! 📬', `A fresh 6-digit verification code has been dispatched to ${this.email}.`);
      },
      error: (err: any) => {
        this.isResending = false;
        this.modalService.alert('Resend Failed', err?.error?.error || 'Failed to resend code. Please try again in a moment.');
      }
    });
  }

  verifyAndCompleteSignup() {
    const otp = this.otpCode?.trim();

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      this.modalService.alert('Invalid Code', 'Please enter the full 6-digit numeric verification code.');
      return;
    }

    this.loading = true;
    const signupData = {
      name: this.name.trim(),
      email: this.email.trim(),
      password: this.password,
      emoji: this.userEmoji,
      otp
    };

    this.taskTrackerService.registerUser(signupData).subscribe({
      next: (response: any) => {
        sessionStorage.setItem('trackJwt', response['token']);
        this.isLoggedIn.emit(true);
        this.loading = false;
        this.router.navigate(['/home']);
      },
      error: (err: any) => {
        this.loading = false;
        this.modalService.alert('Verification Failed', err?.error?.error || 'Invalid or expired verification code.');
      }
    });
  }

  // ===================== FORGOT PASSWORD ===================== //

  requestForgotPasswordOtp() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = this.forgotEmail?.trim();

    if (!email || !emailRegex.test(email)) {
      this.modalService.alert('Invalid Email', 'Please enter a valid account email address.');
      return;
    }

    this.loading = true;
    this.taskTrackerService.forgotPassword(email).subscribe({
      next: () => {
        this.loading = false;
        this.forgotOtpStep = true;
        this.startForgotCooldown(45);
      },
      error: (err: any) => {
        this.loading = false;
        this.modalService.alert('Error', err?.error?.error || 'Failed to send reset code. Please try again.');
      }
    });
  }

  resendForgotOtp() {
    if (this.forgotCooldown > 0 || this.isResending) return;

    this.isResending = true;
    this.taskTrackerService.forgotPassword(this.forgotEmail.trim()).subscribe({
      next: () => {
        this.isResending = false;
        this.startForgotCooldown(45);
        this.modalService.alert('Reset Code Sent! 🔐', `A new password reset code has been emailed to ${this.forgotEmail}.`);
      },
      error: (err: any) => {
        this.isResending = false;
        this.modalService.alert('Resend Failed', err?.error?.error || 'Failed to resend code.');
      }
    });
  }

  submitResetPassword() {
    const otp = this.resetOtpCode?.trim();
    const newPass = this.newPassword;

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      this.modalService.alert('Invalid Code', 'Please enter the 6-digit numeric reset code.');
      return;
    }

    if (!newPass || newPass.length < 6) {
      this.modalService.alert('Weak Password', 'New password must be at least 6 characters long.');
      return;
    }

    this.loading = true;
    this.taskTrackerService.resetPassword({
      email: this.forgotEmail.trim(),
      otp,
      newPassword: newPass
    }).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.modalService.alert(
          'Password Reset Successful! 🎉',
          'Your password has been securely updated. You can now sign in with your new password.'
        );
        this.loginEmail = this.forgotEmail.trim();
        this.loginPassword = '';
        this.toggleMode('login');
      },
      error: (err: any) => {
        this.loading = false;
        this.modalService.alert('Reset Failed', err?.error?.error || 'Invalid or expired reset code. Please try again.');
      }
    });
  }
}
