import type { SiteForgeProject } from "@siteforge/shared";
import { FolderOpen, MapPinned, Plus, Trash2 } from "lucide-react";
import type { RecentProject } from "../lib/projects";

interface ProjectDashboardProps {
  recentProjects: RecentProject[];
  onBlankProject: () => void;
  onFortenvegenProject: () => void;
  onOpenProject: (project: SiteForgeProject) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectDashboard({
  recentProjects,
  onBlankProject,
  onFortenvegenProject,
  onOpenProject,
  onDeleteProject,
}: ProjectDashboardProps) {
  return (
    <section className="dashboard-panel" aria-label="Project dashboard">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Project setup</p>
          <h2>Start blank, open recent, or focus Fortenvegen</h2>
          <p>
            SiteForge saves browser-local project records with previews so you can resume rough planning before the
            backend has full account/project management.
          </p>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={onBlankProject}>
            <Plus size={18} /> Blank project
          </button>
          <button type="button" onClick={onFortenvegenProject}>
            <MapPinned size={18} /> Fortenvegen 100
          </button>
        </div>
      </div>

      <div className="recent-grid">
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
            <strong>No recent projects yet</strong>
            <span>Create a blank or Fortenvegen project, adjust the scene, then save.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

