import { EventEmitter, Injectable } from '@angular/core';
import { ProjectExport } from '../project/project.material';
import { ProjectProperties } from './project-properties';
import { TaskDraftService } from './task-draft.service';
import { TaskDraft } from '../task/task.material';
import { Feature } from 'ol';
import FeatureFormat from 'ol/format/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import { ProjectService } from '../project/project.service';
import { NotificationService } from '../common/services/notification.service';
import { Geometry } from 'ol/geom';

@Injectable({
  providedIn: 'root'
})
export class ProjectImportService {
  public projectPropertiesImported: EventEmitter<ProjectProperties> = new EventEmitter<ProjectProperties>();

  private format: FeatureFormat = new GeoJSON();

  constructor(
    private taskDraftService: TaskDraftService,
    private projectService: ProjectService,
    private notificationService: NotificationService
  ) {
  }

  /**
   * Copies the project export properties and all tasks but without the process points.
   */
  public importProjectAsNewProject(project: ProjectExport): void {
    const maxProcessPoints = Math.max(...project.tasks.map<number>(t=> t.maxProcessPoints));
    const projectProperties = new ProjectProperties(project.name, maxProcessPoints, project.description);
    this.projectPropertiesImported.next(projectProperties);

    const tasksWithGeometries = project.tasks.filter(t => !!t.geometry);

    const taskDrafts = tasksWithGeometries.map(t => {
      const taskFeature = this.format.readFeature(t.geometry) as Feature<Geometry>;
      // @ts-ignore
      return new TaskDraft(undefined, t.name, taskFeature, 0, t.maxProcessPoints);
    });

    this.taskDraftService.addTasks(taskDrafts);
  }

  /**
   * Copies the project export properties and all tasks including the process points.
   */
  public importProject(project: ProjectExport): void {
    this.projectService.importProject(project)
      .subscribe({
        next: () => this.notificationService.addInfo('Project imported'),
        error: (e) => {
          console.error(e);
          this.notificationService.addError('Project import failed: ' + e.error);
        }
      });
  }
}
