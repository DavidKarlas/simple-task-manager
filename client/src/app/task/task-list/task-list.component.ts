import { AfterViewInit, Component, Input } from '@angular/core';
import { Task } from '../task.material';
import { TaskService } from '../task.service';
import { CurrentUserService } from '../../user/current-user.service';
import { Unsubscriber } from '../../common/unsubscriber';

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss']
})
export class TaskListComponent extends Unsubscriber implements AfterViewInit {
  @Input() tasks: Task[];

  constructor(
    private taskService: TaskService,
    private currentUserService: CurrentUserService
  ) {
    super();
  }

  ngAfterViewInit(): void {
    this.unsubscribeLater(
      this.taskService.tasksUpdated.subscribe((updatedTasks: Task[]) => {
        updatedTasks.forEach(u => {
          const index = this.tasks.indexOf(u);
          if (index !== -1) { // when "u" exists in the current tasks -> update it
            this.tasks[index] = u;
          }
          // No else case because tasks can't be added after project creation
        });
      })
    );
  }

  public get selectedTaskId(): string {
    return this.taskService.getSelectedTask().id;
  }

  public isAssignedToCurrentUser(task: Task): boolean {
    return !!task.assignedUser && task.assignedUser.uid === this.currentUserService.getUserId();
  }

  public onListItemClicked(id: string) {
    this.taskService.selectTask(this.tasks.find(t => t.id === id));
  }

  public taskTitle(task: Task): string {
    return !task.name ? task.id : task.name;
  }
}
