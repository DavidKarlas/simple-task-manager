import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ManagerComponent } from './manager/manager.component';
import { AuthComponent } from './auth/auth.component';
import { AuthGuard } from './auth/auth.guard';
import { LoggedInInterceptor } from './auth/logged-in.interceptor';
import { OauthLandingComponent } from './auth/oauth-landing.component';
import { ProjectListComponent } from './project/project-list.component';
import { ProjectComponent } from './project/project.component';
import { TaskListComponent } from './task/task-list.component';
import { TaskDetailsComponent } from './task/task-details.component';
import { TaskMapComponent } from './task/task-map.component';
import { FooterComponent } from './footer.component';
import { ProjectCreationComponent } from './project/project-creation.component';

@NgModule({
  declarations: [
    AppComponent,
    ManagerComponent,
    AuthComponent,
    OauthLandingComponent,
    ProjectListComponent,
    ProjectComponent,
    TaskListComponent,
    TaskDetailsComponent,
    TaskMapComponent,
    FooterComponent,
    ProjectCreationComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
	HttpClientModule
  ],
  providers: [
    AuthGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoggedInInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
