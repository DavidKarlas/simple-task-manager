import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskDetailsComponent } from './task-details.component';
import { CurrentUserService } from '../../user/current-user.service';
import { TaskService } from '../task.service';
import { Task, TestTaskGeometry } from '../task.material';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { WebsocketClientService } from '../../common/websocket-client.service';

describe('TaskDetailsComponent', () => {
  let component: TaskDetailsComponent;
  let fixture: ComponentFixture<TaskDetailsComponent>;
  let taskService: TaskService;
  let currentUserService: CurrentUserService;
  let websocketService: WebsocketClientService;
  const testUserId = '123';

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [TaskDetailsComponent],
      imports: [
        HttpClientTestingModule,
        FormsModule
      ],
      providers: [
        CurrentUserService,
        TaskService,
      ]
    })
      .compileComponents();

    taskService = TestBed.inject(TaskService);
    spyOn(taskService, 'assign').and.callFake((id: string) => {
      const task = createTask(10, id);
      task.assignedUser = testUserId;
      taskService.selectedTaskChanged.emit(task);
      return of(task);
    });
    spyOn(taskService, 'unassign').and.callFake((id: string) => {
      const task = createTask(10, id);
      task.assignedUser = '';
      taskService.selectedTaskChanged.emit(task);
      return of(task);
    });
    spyOn(taskService, 'setProcessPoints').and.callFake((id: string, points: number) => {
      const task = createTask(points, id);
      task.processPoints = points;
      taskService.selectedTaskChanged.emit(task);
      return of(task);
    });

    currentUserService = TestBed.inject(CurrentUserService);
    spyOn(currentUserService, 'getUserId').and.returnValue(testUserId);

    websocketService = TestBed.inject(WebsocketClientService);
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should assign and update task', () => {
    component.task = createTask(10);
    component.onAssignButtonClicked();

    fixture.detectChanges();
    expect(component.task.assignedUser).toEqual(testUserId);
  });

  it('should unassign and update task', () => {
    component.task = createTask(10);
    component.task.assignedUser = testUserId;
    component.onUnassignButtonClicked();

    fixture.detectChanges();
    expect(component.task.assignedUser).toEqual('');
  });

  it('should set process points', () => {
    component.task = createTask(10);
    component.newProcessPoints = 50;
    component.onSaveButtonClick();

    fixture.detectChanges();
    expect(component.task.processPoints).toEqual(50);
  });

  it('should update tasks on updated project', () => {
    const t: Task = createTask(10);
    const newProcessPoints = 50;

    taskService.selectTask(t);
    component.task = t;

    // Update task, this would normally happen via websocket events.
    taskService.updateTasks([createTask(newProcessPoints)]);

    expect(component.task.processPoints).toEqual(newProcessPoints);
  });

  function createTask(processPoints: number, id: string = '123'): Task {
    return new Task(id, processPoints, 100, TestTaskGeometry);
  }
});
