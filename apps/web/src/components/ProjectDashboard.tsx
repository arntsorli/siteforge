import type { SiteForgeProject } from "@siteforge/shared";
import { FolderOpen, MapPinned, Plus, Trash2 } from "lucide-react";
import type { RecentProject } from "../lib/projects";

interface ProjectDashboardProps {
  recentProjects: RecentProject[];
  onBlankProject: () => void;
  onDemoProject: () => void;
  onOpenProject: (project: SiteForgeProject) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectDashboard({
  recentProjects,
  onBlankProject,
  onDemoProject,
  onOpenProject,
  onDeleteProject,
}: ProjectDashboardProps) {
  return (
    <section className="dashboard-panel home-projects" aria-label="Project dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>Open a site or start a new planning scene</h2>
        </div>
        <span>{recentProjects.length} recent</span>
      </div>

      <div className="recent-grid">
        <button type="button" className="project-card create-project-card" onClick={onBlankProject}>
          <Plus size={54} />
          <strong>Create new</strong>
          <span>Start with editable custom terrain</span>
        </button>
        <button type="button" className="project-card preset-project-card" onClick={onDemoProject}>
          <MapPinned size={34} />
          <strong>Norway demo</strong>
          <span>Load a neutral sample area</span>
        </button>
        {recentProjects.map((entry) => (
          <article className="project-card" key={entry.project.id}>
            <img src={entry.previewUri} alt="" />
            <div className="project-card-body">
              <div>
                <strong>{entry.project.name}</strong>
                <span>{entry.locationLabel}</span>
                <span>Updated {new Date(entry.savedAt).toLocaleString()}</span>
              </div>
              <div className="project-card-actions">
                <button type="button" onClick={() => onOpenProject(entry.project)}>
                  <FolderOpen size={17} /> Open
                </button>
                <button
                  type="button"
                  className="icon-danger"
                  onClick={() => onDeleteProject(entry.project.id)}
                  title="Remove recent project"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </article>
        ))}
        {recentProjects.length === 0 ? (
          <div className="empty-recents">
            <strong>No saved projects yet</strong>
            <span>Create a project, adjust the scene, then save to pin a preview here.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
