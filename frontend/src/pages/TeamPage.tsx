import { useState, useEffect, useRef, type MouseEvent } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, TextField, Button, IconButton, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Chip, Grid, Tooltip, Divider,
  List, ListItem, ListItemAvatar, ListItemText, ListItemSecondaryAction, Tabs, Tab,
  Menu, MenuItem, Fade, Collapse
} from '@mui/material';
import {
  Delete as DeleteIcon, ContentCopy as ContentCopyIcon, Add as AddIcon,
  Email as EmailIcon, VerifiedUser as VerifiedUserIcon, Pending as PendingIcon,
  Close as CloseIcon, MoreVert as MoreVertIcon, FolderOpen as FolderOpenIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { getUserProjects, getProjectMembers, createProject, deleteProject, updateProjectName, removeProjectMember } from '../services/projectService';
import { createInvitation, getPendingInvitations, cancelInvitation } from '../services/invitationService';

// Workaround: MUI Grid typings workaround
const GridAny: any = Grid;

interface Project {
  id: string;
  name: string;
  ownerId?: string;
}

interface Member {
  userId: string;
  role: string;
  email: string;
  fullName?: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  createdAt?: any;
  status?: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { currentProject, setCurrentProject } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const membersCacheRef = useRef<Record<string, Member[]>>({});
  const invitationsCacheRef = useRef<Record<string, PendingInvitation[]>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const invitingRef = useRef(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleteProjectConfirmOpen, setDeleteProjectConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [leaveProjectConfirmOpen, setLeaveProjectConfirmOpen] = useState(false);

  // Cargar proyectos del usuario - Se ejecuta cada vez que el componente se monta
  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }

    const loadProjects = async () => {
      setProjectsLoading(true);
      try {
        const loadedProjects = await getUserProjects(user.uid) as Project[];
        setProjects(loadedProjects);
        // Si hay proyecto actual seleccionado, mantenerlo
        if (currentProject?.id && loadedProjects.find(p => p.id === currentProject.id)) {
          setSelectedProjectId(currentProject.id);
        }
      } catch (error) {
        console.error('Error cargando proyectos:', error);
      } finally {
        setProjectsLoading(false);
      }
    };

    loadProjects();
  }, [user]);

  useEffect(() => {
    if (currentProject?.id && !selectedProjectId) {
      setSelectedProjectId(currentProject.id);
    }
  }, [currentProject, selectedProjectId]);

  // Al seleccionar proyecto, cargar miembros, invitaciones y verificar si el usuario es admin
  useEffect(() => {
    if (!selectedProjectId || !user) return;

    const cachedMembers = membersCacheRef.current[selectedProjectId];
    const cachedInvitations = invitationsCacheRef.current[selectedProjectId];

    if (cachedMembers) {
      setMembers(cachedMembers);
    }
    if (cachedInvitations) {
      setPendingInvitations(cachedInvitations);
    }

    const loadProjectData = async () => {
      setMembersLoading(true);
      try {
        const rawMembers = await getProjectMembers(selectedProjectId) as Member[];
        const membersList = Array.from(new Map(rawMembers.map(member => [member.userId, member])).values());
        setMembers(membersList);
        membersCacheRef.current[selectedProjectId] = membersList;

        const currentUserMember = membersList.find(m => m.userId === user.uid);
        setIsAdmin(currentUserMember?.role === 'admin');

        const invitations = await getPendingInvitations(selectedProjectId) as PendingInvitation[];
        const normalizedInvitations = Array.from(
          invitations.reduce<Map<string, PendingInvitation>>((map, inv) => {
            map.set(String(inv.email).trim().toLowerCase(), {
              id: inv.id,
              email: String(inv.email).trim().toLowerCase(),
              createdAt: inv.createdAt,
              status: inv.status
            });
            return map;
          }, new Map()).values()
        );
        setPendingInvitations(normalizedInvitations);
        invitationsCacheRef.current[selectedProjectId] = normalizedInvitations;

        setInviteMessage('');
        setInviteError('');
        setInviteLink('');
      } catch (error) {
        console.error('Error cargando miembros:', error);
      } finally {
        setMembersLoading(false);
      }
    };

    loadProjectData();
  }, [selectedProjectId, user]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !selectedProjectId || !user) return;
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (isInviting) return;

    if (invitingRef.current) return;
    invitingRef.current = true;
    setInviteError('');
    setInviteMessage('');
    setIsInviting(true);

    try {
      if (members.some(member => member.email?.toLowerCase() === normalizedEmail)) {
        throw new Error('Este usuario ya es miembro del proyecto.');
      }
      if (pendingInvitations.some(inv => inv.email.toLowerCase() === normalizedEmail)) {
        throw new Error('Ya existe una invitación pendiente para este correo.');
      }

      const projectName = projects.find(p => p.id === selectedProjectId)?.name || 'Proyecto';
      const senderName = user.displayName || user.email?.split('@')[0] || 'Usuario';
      const invitation = await createInvitation(normalizedEmail, selectedProjectId, user.uid, projectName, senderName);
      const link = `${window.location.origin}/accept-invite/${invitation.token}`;

      setInviteLink(link);
      setInviteMessage(`✓ Invitación enviada a ${normalizedEmail}`);
      setPendingInvitations((prev) => {
        const updatedMap = new Map<string, PendingInvitation>();
        prev.forEach((inv) => updatedMap.set(inv.email.toLowerCase(), inv));
        updatedMap.set(normalizedEmail, {
          id: invitation.id,
          email: normalizedEmail,
          createdAt: new Date(),
          status: 'pending'
        });
        return Array.from(updatedMap.values());
      });
      setInviteEmail('');
    } catch (error) {
      setInviteError((error instanceof Error ? error.message : String(error)) || 'Error al enviar la invitación');
      console.error('Error en handleSendInvite:', error);
    } finally {
      invitingRef.current = false;
      setIsInviting(false);
    }
  };

  const handleOpenProjectMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseProjectMenu = () => {
    setAnchorEl(null);
  };

  const handleOpenRenameDialog = () => {
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    if (!selectedProject) return;
    setRenameProjectName(selectedProject.name);
    setRenameDialogOpen(true);
    handleCloseProjectMenu();
  };

  const handleRenameProject = async () => {
    if (!selectedProjectId || !renameProjectName.trim()) return;
    try {
      await updateProjectName(selectedProjectId, renameProjectName.trim());
      const updatedProjects = projects.map((project) =>
        project.id === selectedProjectId ? { ...project, name: renameProjectName.trim() } : project
      );
      setProjects(updatedProjects);
      setCurrentProject(updatedProjects.find((project) => project.id === selectedProjectId) || null);
      setRenameDialogOpen(false);
    } catch (error) {
      console.error('Error renombrando proyecto:', error);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(invitationId);
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } catch (error) {
      console.error('Error cancelando invitación:', error);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || !selectedProjectId) return;

    try {
      await removeProjectMember(selectedProjectId, memberToDelete.userId);
      const updatedMembers = members.filter(m => m.userId !== memberToDelete.userId);
      setMembers(updatedMembers);
      membersCacheRef.current[selectedProjectId] = updatedMembers;
    } catch (error) {
      console.error('Error eliminando miembro del proyecto:', error);
    } finally {
      setDeleteConfirmOpen(false);
      setMemberToDelete(null);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete.id);
      const remainingProjects = projects.filter(p => p.id !== projectToDelete.id);
      setProjects(remainingProjects);

      if (selectedProjectId === projectToDelete.id) {
        if (remainingProjects.length > 0) {
          setSelectedProjectId(remainingProjects[0].id);
          setCurrentProject(remainingProjects[0]);
        } else {
          setSelectedProjectId('');
          setCurrentProject(null);
        }
      }
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
    } finally {
      setProjectToDelete(null);
      setDeleteProjectConfirmOpen(false);
    }
  };

  const handleLeaveProject = async () => {
    if (!selectedProjectId || !user) return;
    try {
      await removeProjectMember(selectedProjectId, user.uid);
      const remainingProjects = projects.filter(p => p.id !== selectedProjectId);
      setProjects(remainingProjects);

      if (remainingProjects.length > 0) {
        setSelectedProjectId(remainingProjects[0].id);
        setCurrentProject(remainingProjects[0]);
      } else {
        setSelectedProjectId('');
        setCurrentProject(null);
      }
    } catch (error) {
      console.error('Error al salir del proyecto:', error);
    } finally {
      setLeaveProjectConfirmOpen(false);
      handleCloseProjectMenu();
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !user) return;
    const projectId = await createProject(newProjectName, user.uid);
    setOpenCreate(false);
    setNewProjectName('');
    const updated = await getUserProjects(user.uid) as Project[];
    setProjects(updated);
    const createdProject = updated.find((project) => project.id === projectId);
    if (createdProject) {
      setCurrentProject(createdProject);
      setSelectedProjectId(createdProject.id);
    }
  };

  const getAvatarColor = (email: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    const index = email.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (fullName?: string, email?: string) => {
    if (fullName) {
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.split('@')[0].slice(0, 2).toUpperCase() || '?';
  };

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  const formatDateTime = (value: any) => {
    if (!value) return '';
    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'object' && typeof value.seconds === 'number') {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(String(value));
    }
    return isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Encabezado */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}> Equipo</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>Gestiona tus proyectos y miembros colaborativos</Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, alignItems: 'stretch' }}>
        <Paper sx={{ flex: 1, p: 3, borderRadius: 4, boxShadow: 2, minWidth: 280, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Mis proyectos</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>Crear proyecto</Button>
          </Box>

          {projectsLoading && projects.length === 0 ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              {[1, 2, 3].map(idx => (
                <Paper key={idx} sx={{ p: 3, bgcolor: 'action.hover', height: 120, borderRadius: 3 }} />
              ))}
            </Box>
          ) : projects.length > 0 ? (
            <GridAny container spacing={2}>
              {projects.map(proj => {
                const selected = selectedProjectId === proj.id;
                const isOwner = proj.ownerId === user?.uid;
                return (
                  <GridAny xs={12} sm={6} md={12} key={proj.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                        border: selected ? '2px solid #2563eb' : '1px solid rgba(226,232,240,0.9)',
                        bgcolor: selected ? 'action.selected' : 'background.paper',
                        '&:hover': {
                          boxShadow: 3,
                          transform: 'translateY(-2px)'
                        }
                      }}
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setCurrentProject(proj);
                        setTabValue(0);
                      }}
                    >
                      <CardContent sx={{ pb: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', minWidth: 0 }}>
                            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: selected ? 'primary.main' : 'grey.100', color: selected ? 'common.white' : 'primary.main', display: 'grid', placeItems: 'center' }}>
                              {isOwner ? <FolderOpenIcon fontSize="small" /> : <GroupIcon fontSize="small" />}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {proj.name}
                              </Typography>
                              <Chip
                                label={isOwner ? 'Propietario' : 'Colaborador'}
                                size="small"
                                color={isOwner ? 'primary' : 'default'}
                                sx={{ mt: 1, textTransform: 'uppercase', fontSize: '0.7rem' }}
                              />
                            </Box>
                          </Box>
                          <Tooltip title="Seleccionar proyecto">
                            <IconButton size="small" sx={{ color: selected ? 'primary.main' : 'text.secondary' }}>
                              <MoreVertIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </GridAny>
                );
              })}
            </GridAny>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="body1" sx={{ mb: 2 }}>No tienes proyectos aún.</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>Crea uno nuevo con el botón + para comenzar a colaborar.</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>Crear proyecto</Button>
            </Paper>
          )}
        </Paper>

        <Fade in={Boolean(selectedProjectId)} timeout={300} style={{ width: '100%' }}>
          <Paper sx={{ flex: 2, borderRadius: 4, boxShadow: 2, minWidth: 320, bgcolor: 'background.paper', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selectedProject ? (
              <>
                <Box sx={{ p: 3, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{selectedProject.name}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{members.length} {members.length === 1 ? 'miembro' : 'miembros'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
                      {isAdmin && (
                        <Button
                          variant="outlined"
                          startIcon={<EmailIcon />}
                          onClick={() => setInviteDialogOpen(true)}
                        >
                          Invitar
                        </Button>
                      )}
                      <IconButton
                        size="small"
                        onClick={handleOpenProjectMenu}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
</Box>
                </Box>

                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleCloseProjectMenu}
                >
                  <MenuItem onClick={handleOpenRenameDialog}>Editar nombre</MenuItem>
                  {isAdmin && (
                    <MenuItem onClick={() => {
                      setProjectToDelete(selectedProject);
                      setDeleteProjectConfirmOpen(true);
                      handleCloseProjectMenu();
                    }}>
                      Eliminar proyecto
                    </MenuItem>
                  )}
                  {!isAdmin && (
                    <MenuItem onClick={() => {
                      setLeaveProjectConfirmOpen(true);
                      handleCloseProjectMenu();
                    }} sx={{ color: 'error.main' }}>
                      Salir del proyecto
                    </MenuItem>
                  )}
                </Menu>

                <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} variant="fullWidth" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Tab label={`Miembros (${members.length})`} />
                  <Tab label={`Invitar ${pendingInvitations.length > 0 ? `(${pendingInvitations.length})` : ''}`} />
                </Tabs>

                <Box sx={{ p: 3, flex: 1 }}>
                  {tabValue === 0 && (
                    <Box>
                      {membersLoading ? (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Cargando miembros...</Typography>
                        </Box>
                      ) : members.length > 0 ? (
                        <List>
                          {members.map((member, idx) => (
                            <Collapse key={member.userId} in timeout={300}>
                              <Box>
                                <ListItem sx={{ py: 2 }}>
                                  <ListItemAvatar>
                                    <Avatar
                                      sx={{
                                        bgcolor: getAvatarColor(member.email),
                                        fontWeight: 600,
                                        color: 'white'
                                      }}
                                    >
                                      {getInitials(member.fullName, member.email)}
                                    </Avatar>
                                  </ListItemAvatar>
                                  <ListItemText
                                    disableTypography
                                    primary={
                                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                          {member.fullName || member.email}
                                        </Typography>
                                        {member.userId === user?.uid && <Chip label="Tú" size="small" color="primary" variant="outlined" />}
                                      </Box>
                                    }
                                    secondary={
                                      <Box sx={{ mt: 0.5 }}>
                                        <Typography variant="caption" sx={{ display: 'block' }}>{member.email}</Typography>
                                        <Box sx={{ mt: 0.5 }}>
                                          <Chip
                                            icon={member.role === 'admin' ? <VerifiedUserIcon /> : undefined}
                                            label={member.role === 'admin' ? 'Administrador' : 'Miembro'}
                                            size="small"
                                            color={member.role === 'admin' ? 'primary' : 'default'}
                                            variant="outlined"
                                          />
                                        </Box>
                                      </Box>
                                    }
                                  />
                                  {isAdmin && member.userId !== user?.uid && (
                                    <ListItemSecondaryAction>
                                      <Tooltip title="Eliminar miembro">
                                        <IconButton
                                          edge="end"
                                          onClick={() => {
                                            setMemberToDelete(member);
                                            setDeleteConfirmOpen(true);
                                          }}
                                          sx={{ color: 'error.main' }}
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </ListItemSecondaryAction>
                                  )}
                                </ListItem>
                                {idx < members.length - 1 && <Divider />}
                              </Box>
                            </Collapse>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>Aún no hay miembros. Invita a alguien usando el formulario.</Typography>
                      )}
                    </Box>
                  )}

                  {tabValue === 1 && isAdmin && (
                    <Box>
                      <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px dashed', borderColor: 'divider', mb: 3, bgcolor: 'action.hover' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EmailIcon fontSize="small" /> Invitar nuevo miembro
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center' }}>
                          <TextField
                            placeholder="correo@ejemplo.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            sx={{ flexGrow: 1, minWidth: 250 }}
                            size="small"
                            type="email"
                            disabled={isInviting}
                          />
                          <Button
                            variant="contained"
                            onClick={handleSendInvite}
                            disabled={!inviteEmail.trim() || isInviting}
                          >
                            {isInviting ? 'Enviando...' : 'Enviar invitación'}
                          </Button>
                        </Box>
                        {inviteError && <Alert severity="error" sx={{ mt: 2 }}>{inviteError}</Alert>}
                        {inviteMessage && <Alert severity="success" sx={{ mt: 2 }}>{inviteMessage}</Alert>}
                      </Paper>

                      {inviteLink && (
                        <Paper sx={{ p: 2.5, bgcolor: '#f0f7ff', borderLeft: '4px solid #2196f3', borderRadius: 2, mb: 3 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Enlace de invitación</Typography>
                          <Box sx={{
                            p: 1.5,
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            wordBreak: 'break-all',
                            mb: 1
                          }}>
                            {inviteLink}
                          </Box>
                          <Button
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            onClick={() => {
                              navigator.clipboard.writeText(inviteLink);
                              alert('✓ Enlace copiado al portapapeles');
                            }}
                            sx={{ color: '#2196f3' }}
                          >
                            Copiar enlace
                          </Button>
                        </Paper>
                      )}

                      {pendingInvitations.length > 0 && (
                        <Paper sx={{ p: 2.5, bgcolor: 'background.paper', borderRadius: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PendingIcon fontSize="small" /> Invitaciones pendientes ({pendingInvitations.length})
                          </Typography>
                          <List dense>
                            {pendingInvitations.map(inv => (
                              <Collapse key={inv.id} in timeout={300}>
                                <ListItem secondaryAction={
                                  <IconButton
                                    edge="end"
                                    size="small"
                                    onClick={() => handleCancelInvitation(inv.id)}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                }>
                                  <ListItemText
                                    primary={inv.email}
                                    secondary={formatDateTime(inv.createdAt) || 'Pendiente'}
                                  />
                                </ListItem>
                              </Collapse>
                            ))}
                          </List>
                        </Paper>
                      )}
                    </Box>
                  )}

                  {tabValue === 1 && !isAdmin && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Solo los administradores pueden invitar nuevos miembros.</Typography>
                    </Box>
                  )}
                </Box>
              </>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Selecciona un proyecto para ver sus detalles</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Pulsa una tarjeta de proyecto de la izquierda para revisar miembros, invitaciones y ajustes.</Typography>
              </Box>
            )}
          </Paper>
        </Fade>
      </Box>

      {/* Diálogo: Confirmar Eliminar Miembro */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Eliminar miembro</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Estás seguro de que quieres eliminar a <strong>{memberToDelete?.fullName || memberToDelete?.email}</strong> del proyecto?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleDeleteMember} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteProjectConfirmOpen} onClose={() => setDeleteProjectConfirmOpen(false)}>
        <DialogTitle>Eliminar proyecto</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Estás seguro de que quieres eliminar el proyecto <strong>{projectToDelete?.name}</strong>? Esta acción también borrará sus miembros y tareas asociadas.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProjectConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleConfirmDeleteProject} color="error" variant="contained">Eliminar proyecto</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Editar nombre del proyecto</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Nuevo nombre"
            fullWidth
            value={renameProjectName}
            onChange={(e) => setRenameProjectName(e.target.value)}
            placeholder="Nuevo nombre del proyecto"
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleRenameProject} variant="contained" disabled={!renameProjectName.trim()}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}>
        <DialogTitle>Invitar miembro</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Correo del invitado"
            type="email"
            fullWidth
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            size="small"
            disabled={isInviting}
          />
          {inviteError && <Alert severity="error" sx={{ mt: 2 }}>{inviteError}</Alert>}
          {inviteMessage && <Alert severity="success" sx={{ mt: 2 }}>{inviteMessage}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInviteDialogOpen(false); setInviteError(''); setInviteMessage(''); }}>Cancelar</Button>
          <Button onClick={async () => { await handleSendInvite(); if (!inviteError) setInviteDialogOpen(false); }} variant="contained" disabled={!inviteEmail.trim() || isInviting}>
            {isInviting ? 'Enviando...' : 'Enviar invitación'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Confirmar Salir del Proyecto */}
      <Dialog open={leaveProjectConfirmOpen} onClose={() => setLeaveProjectConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 600 }}>Salir del Proyecto</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            ¿Estás seguro de que deseas salir de este proyecto colaborativo? No podrás acceder a él a menos que el administrador te vuelva a invitar.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveProjectConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleLeaveProject} variant="contained" color="error">Salir</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Crear Nuevo Proyecto */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}> Nuevo Proyecto Colaborativo</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            label="Nombre del proyecto"
            fullWidth
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Ej: Marketing 2024"
            variant="outlined"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newProjectName.trim()) {
                handleCreateProject();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreate(false)}>Cancelar</Button>
          <Button onClick={handleCreateProject} variant="contained" disabled={!newProjectName.trim()}>Crear Proyecto</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}