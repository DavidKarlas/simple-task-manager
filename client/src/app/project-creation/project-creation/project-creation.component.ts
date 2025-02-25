import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from '../../project/project.service';
import { Feature, Map, MapEvent, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { OSM } from 'ol/source';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Attribution, ScaleLine } from 'ol/control';
import { Polygon } from 'ol/geom';
import { Fill, Stroke, Style } from 'ol/style';
import { Draw } from 'ol/interaction';
import { NotificationService } from '../../common/notification.service';
import GeometryType from 'ol/geom/GeometryType';
import { CurrentUserService } from '../../user/current-user.service';
import Snap from 'ol/interaction/Snap';
import Modify from 'ol/interaction/Modify';
import Select, { SelectEvent } from 'ol/interaction/Select';
import { Observable, Subject } from 'rxjs';
import Interaction from 'ol/interaction/Interaction';
import { ProjectProperties } from '../project-properties';
import { DrawEvent } from 'ol/interaction/Draw';
import { TaskDraftService } from '../task-draft.service';
import { TaskDraft } from '../../task/task.material';
import { FeatureLike } from 'ol/Feature';
import { ConfigProvider } from '../../config/config.provider';
import { extend } from 'ol/extent';
import { Size } from 'ol/size';
import { ProjectImportService } from '../project-import.service';
import { Project } from '../../project/project.material';
import { Unsubscriber } from '../../common/unsubscriber';

@Component({
  selector: 'app-project-creation',
  templateUrl: './project-creation.component.html',
  styleUrls: ['./project-creation.component.scss']
})
export class ProjectCreationComponent extends Unsubscriber implements OnInit, AfterViewInit {
  public projectProperties: ProjectProperties = new ProjectProperties('', 100, '');
  public existingProjects: Observable<Project[]>;

  // public for tests
  public modifyInteraction: Modify;
  public drawInteraction: Draw;
  public removeInteraction: Select;
  public selectInteraction: Select;

  public vectorSource: VectorSource;
  private vectorLayer: VectorLayer;
  public previewVectorSource: VectorSource;
  private previewVectorLayer: VectorLayer;

  // For the toolbar
  public resetToolbarSelectionSubject: Subject<void> = new Subject<void>();

  private map: Map;

  constructor(
    private projectService: ProjectService,
    private taskDraftService: TaskDraftService,
    private notificationService: NotificationService,
    private currentUserService: CurrentUserService,
    private projectImportService: ProjectImportService,
    private router: Router,
    public config: ConfigProvider
  ) {
    super();
  }

  ngOnInit(): void {
    this.unsubscribeLater(
      this.taskDraftService.tasksAdded.subscribe((tasks: TaskDraft[]) => {
        this.addTasks(tasks);
      }),
      this.taskDraftService.taskRemoved.subscribe((id: string) => {
        this.removeTask(id);
      }),
      this.taskDraftService.taskSelected.subscribe(() => {
        this.previewVectorSource.clear();
        this.vectorLayer.changed();
      }),
      this.taskDraftService.taskChanged.subscribe((task: TaskDraft) => {
        this.removeTask(task.id);
        this.addTasks([task]);
      }),
      this.projectImportService.projectPropertiesImported.subscribe((properties: ProjectProperties) => {
        this.projectProperties = properties;
      })
    );

    this.existingProjects = this.projectService.getProjects();
  }

  ngAfterViewInit(): void {
    // this vector source contains all the task geometries
    this.vectorSource = new VectorSource();
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: (f, r) => this.getStyle(f)
    });

    // this vector source contains all the task geometries for a preview
    this.previewVectorSource = new VectorSource();
    this.previewVectorLayer = new VectorLayer({
      source: this.previewVectorSource,
      style: this.getPreviewStyle()
    });

    this.map = new Map({
      target: 'map',
      controls: [
        new ScaleLine(),
        new Attribution()
      ],
      layers: [
        new TileLayer({
          source: new OSM()
        }),
        this.vectorLayer,
        this.previewVectorLayer
      ],
      view: new View({
        center: [1111000, 7086000],
        projection: 'EPSG:3857',
        zoom: 14,
        minZoom: 0,
        maxZoom: 19
      })
    });

    // Restore map center
    const center = localStorage.getItem('project_creation_map_center');
    if (!!center) {
      this.map.getView().setCenter(JSON.parse(center));
    }

    // Update map center after map has been moved
    this.map.on('moveend', (e: MapEvent) => {
      localStorage.setItem('project_creation_map_center', JSON.stringify(e.map.getView().getCenter()));
    });

    this.addMapInteractions();
  }

  private getStyle(feature: FeatureLike): Style {
    const borderColor = '#00968890';
    let fillColor = '#80cbc4';

    // Less opaque, when selected
    if (!!this.selectedTask && feature.get('id') === this.selectedTask.id) {
      fillColor += '80';
    } else {
      fillColor += '40';
    }

    return new Style({
      stroke: new Stroke({
        color: borderColor,
        width: 2,
      }),
      fill: new Fill({
        color: fillColor
      })
    });
  }

  private getPreviewStyle(): Style {
    const borderColor = '#009688';

    return new Style({
      stroke: new Stroke({
        color: borderColor,
        width: 2,
      })
    });
  }

  public get rootTabTitles(): string[] {
    return [
      $localize`:@@TABS_PROPERTIES:Properties`,
      $localize`:@@TABS_TASKS:Tasks`,
      $localize`:@@TABS_IMPORT:Import`,
      $localize`:@@TABS_REMOTE:Remote`
    ];
  }

  public get canAddTasks(): boolean {
    return this.taskDraftService.getTasks().length < this.config.maxTasksPerProject;
  }

  public get taskDrafts(): TaskDraft[] {
    return this.taskDraftService.getTasks();
  }

  public get selectedTask(): TaskDraft | undefined {
    return this.taskDraftService.getSelectedTask();
  }

  /**
   * Called after a task has been added to the task draft service.
   */
  private addTasks(tasks: TaskDraft[]) {
    const mapPaddingPx = 25;
    const newFeatures = tasks.map(t => this.toFeature(t));
    this.vectorSource.addFeatures(newFeatures);

    // Subtract the padding from the map size. This padding will be added back to the map size below.
    const mapSize = this.map.getSize();
    if (!mapSize) {
      this.notificationService.addError('Unable to get map size');
      return;
    }

    const paddedMapSize = [
      mapSize[0] - 2 * mapPaddingPx,
      mapSize[1] - 2 * mapPaddingPx
    ] as Size;
    let overallExtent = this.map.getView().calculateExtent(paddedMapSize);

    // Try to extend the extent over all new features: If one feature is outside the current extent, then the map view should be adjusted
    // @ts-ignore
    newFeatures.forEach(f => overallExtent = extend(overallExtent, f.getGeometry().getExtent()));

    this.map.getView().fit(overallExtent, {
      size: mapSize,
      padding: [mapPaddingPx, mapPaddingPx, mapPaddingPx, mapPaddingPx] // in pixels
    });

    if (!this.canAddTasks) {
      this.setInteraction(this.drawInteraction, false);
    }
  }

  private removeTask(id: string | undefined) {
    const featureToRemove = this.vectorSource.getFeatures().find(f => f.get('id') === id);
    if (!id || !featureToRemove) {
      return;
    }

    this.vectorSource.removeFeature(featureToRemove);
  }

  private addMapInteractions() {
    // DRAW
    this.drawInteraction = new Draw({
      type: GeometryType.POLYGON
    });
    this.drawInteraction.setActive(false);
    this.drawInteraction.on('drawend', (e: DrawEvent) => {
      // Add shaped but do not transform them (first *false*) and do not move map view (second *false)
      this.taskDraftService.addTasks([this.taskDraftService.toTaskDraft(e.feature)], false);
    });
    this.map.addInteraction(this.drawInteraction);

    // MODIFY
    const snap = new Snap({
      source: this.vectorSource
    });
    this.map.addInteraction(snap);

    this.modifyInteraction = new Modify({
      source: this.vectorSource
    });
    this.modifyInteraction.setActive(false);
    this.map.addInteraction(this.modifyInteraction);

    // DELETE
    this.removeInteraction = new Select();
    this.removeInteraction.on('select', (e: SelectEvent) => {
      if (!!e.selected[0]) {
        const id = e.selected[0].get('id') as string;
        this.taskDraftService.removeTask(id);
      }
    });
    this.removeInteraction.setActive(false);
    this.map.addInteraction(this.removeInteraction);

    // SELECT
    this.selectInteraction = new Select({
      layers: [this.vectorLayer],
      style: undefined
    });
    this.selectInteraction.on('select', (e: SelectEvent) => {
      if (!!e.selected[0]) {
        this.taskDraftService.selectTask(e.selected[0].get('id'));
      } else {
        this.taskDraftService.deselectTask();
      }
    });
    this.map.addInteraction(this.selectInteraction);
  }

  // See if the vector layer has some features.
  public get hasTasks(): boolean {
    return this.taskDraftService.hasTasks();
  }

  // TODO pass TaskDrafts here to "createProject"
  public onSaveButtonClicked() {
    const features: Feature[] = this.vectorSource.getFeatures().map(f => {
      f = f.clone(); // otherwise we would change the polygons on the map
      let polygon = (f.getGeometry() as Polygon);

      // Even though we transformed the coordinates after their creation from EPSG:4326 into EPSG:3857, the OSM- and overall Geo-World works
      // with lat/lon values, so we transform it back.
      polygon = polygon.transform('EPSG:3857', 'EPSG:4326') as Polygon;
      f.setGeometry(polygon);

      return f;
    });

    this.createProject(
      this.projectProperties.projectName,
      this.projectProperties.maxProcessPoints,
      this.projectProperties.projectDescription,
      features
    );
  }

  public createProject(name: string, maxProcessPoints: number, projectDescription: string, features: Feature[]) {
    const owner = this.currentUserService.getUserId();
    if (!owner) {
      // TODO Show error notification
      return;
    }

    this.projectService.createNewProject(name, maxProcessPoints, projectDescription, features, [owner], owner)
      .subscribe(project => {
        this.router.navigate(['/manager']);
      }, e => {
        console.error(e);
        this.notificationService.addError(($localize`:@@ERROR_NOT_CREATE_PROJ:Could not create project`) + ': ' + e.error);
      });
  }

  onTabSelected() {
    // Disable all interactions and also notify the toolbar that all interactions are disabled (-> toolbar will remove any selection)
    this.drawInteraction.setActive(false);
    this.modifyInteraction.setActive(false);
    this.removeInteraction.setActive(false);
    this.selectInteraction.setActive(true);

    this.previewVectorSource.clear();

    this.resetToolbarSelectionSubject.next();
  }

  onZoomIn() {
    const zoom = this.map.getView().getZoom();
    if (!zoom) {
      return;
    }

    this.map.getView().setZoom(zoom + 1);
  }

  onZoomOut() {
    const zoom = this.map.getView().getZoom();
    if (!zoom) {
      return;
    }

    this.map.getView().setZoom(zoom - 1);
  }

  onToggleDraw() {
    this.setInteraction(this.drawInteraction, !this.drawInteraction.getActive());
  }

  onToggleEdit() {
    this.setInteraction(this.modifyInteraction, !this.modifyInteraction.getActive());
  }

  onToggleDelete() {
    this.setInteraction(this.removeInteraction, !this.removeInteraction.getActive());
  }

  setInteraction(interaction: Interaction, active: boolean) {
    this.drawInteraction.setActive(false);
    this.modifyInteraction.setActive(false);
    this.removeInteraction.setActive(false);

    interaction.setActive(active);

    // When no button active -> Activate select interaction
    this.selectInteraction.getFeatures().clear();
    this.selectInteraction.setActive(
      !this.drawInteraction.getActive() &&
      !this.modifyInteraction.getActive() &&
      !this.removeInteraction.getActive()
    );

    this.taskDraftService.deselectTask();
  }

  onDividePreviewClicked(taskDrafts: TaskDraft[]) {
    this.previewVectorSource.clear();
    this.previewVectorSource.addFeatures(taskDrafts.map(t => this.toFeature(t)));
  }

  public toFeature(task: TaskDraft): Feature {
    const f = task.geometry;
    f.set('id', task.id);
    f.set('name', task.name);
    f.set('maxProcessPoints', task.maxProcessPoints);
    return f;
  }
}
