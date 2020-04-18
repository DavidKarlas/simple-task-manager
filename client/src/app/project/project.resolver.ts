import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, RouterStateSnapshot } from '@angular/router';
import { Project } from './project.material';
import { ProjectService } from './project.service';
import { Observable } from 'rxjs';

@Injectable({providedIn: 'root'})
export class ProjectResolver implements Resolve<Project> {
  constructor(
    private projectService: ProjectService
  ) {
  }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<Project> {
    return this.projectService.getProject(route.paramMap.get('id'));
  }
}
