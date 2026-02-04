import { getVersionedEndpoint } from '../utils/api-paths.js';
import { handleDeskbirdException } from '../utils/error-handler.js';
import type { HttpClient } from '../utils/http-client.js';

/**
 * Interface for floor configuration data
 */
interface FloorConfigResponse {
  success: boolean;
  data?: {
    floorConfig: string; // JSON string containing the floor configuration
  };
}

/**
 * Interface for internal workspaces response
 */
interface InternalWorkspacesResponse {
  results: Array<{
    id: string;
    name: string;
    isActive: boolean;
    isClosed?: boolean;
    [key: string]: any;
  }>;
}

/**
 * Interface for workspace groups response
 */
interface WorkspaceGroupsResponse {
  results: Array<{
    id: string;
    name: string;
    isActive: boolean;
    floorConfigReady: boolean;
    [key: string]: any;
  }>;
}

/**
 * Interface for parsed desk information
 */
export interface DeskInfo {
  id: string;
  title: string;
  deskNumber: number | null;
  zoneId: string;
  areaName: string;
  status: string;
}

/**
 * Workspaces API client for workspace and floor configuration operations
 */
export class WorkspacesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * Get internal workspaces for a company
   */
  async getInternalWorkspaces(companyId: string): Promise<InternalWorkspacesResponse> {
    try {
      // Build URL with query parameters
      const baseEndpoint = getVersionedEndpoint('WORKSPACES_INTERNAL', '/company/internalWorkspaces');
      const queryParams = new URLSearchParams({
        companyId,
        includeInactive: 'false',
      });
      const fullPath = `${baseEndpoint}?${queryParams.toString()}`;

      const response = await this.client.get<InternalWorkspacesResponse>(fullPath);

      if (!response.success || !response.data) {
        throw new Error(`Failed to get internal workspaces: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getInternalWorkspaces');
    }
  }

  /**
   * Get groups for a workspace
   */
  async getWorkspaceGroups(workspaceId: string): Promise<WorkspaceGroupsResponse> {
    try {
      const response = await this.client.get<WorkspaceGroupsResponse>(
        getVersionedEndpoint('WORKSPACE_GROUPS', `/company/internalWorkspaces/${workspaceId}/groups`)
      );

      if (!response.success || !response.data) {
        throw new Error(`Failed to get workspace groups: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getWorkspaceGroups');
    }
  }

  /**
   * Get floor configuration for a workspace group
   */
  async getFloorConfig(workspaceId: string, groupId: string): Promise<FloorConfigResponse> {
    try {
      const response = await this.client.get<FloorConfigResponse>(
        getVersionedEndpoint('WORKSPACE_FLOOR_CONFIG', `/company/internalWorkspaces/${workspaceId}/groups/${groupId}/floorConfig`)
      );

      if (!response.success || !response.data) {
        throw new Error(`Failed to get floor config: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getFloorConfig');
    }
  }

  /**
   * Parse floor configuration and extract desk information
   */
  parseFloorConfig(floorConfigJson: string): DeskInfo[] {
    try {
      const floorConfig = JSON.parse(floorConfigJson);
      const allDesks: DeskInfo[] = [];

      // Collect all desks from all areas
      for (const area of floorConfig.areas || []) {
        if (area.desks && Array.isArray(area.desks)) {
          for (const desk of area.desks) {
            // Extract desk number from title (e.g., "Desk 57" -> 57)
            const deskNumberMatch = desk.title?.match(/(\d+)/);
            const deskNumber = deskNumberMatch ? parseInt(deskNumberMatch[1]) : null;

            allDesks.push({
              id: desk.id,
              title: desk.title,
              deskNumber: deskNumber,
              zoneId: desk.zoneId,
              areaName: area.name,
              status: desk.status || 'unknown',
            });
          }
        }
      }

      // Sort desks by desk number for better readability
      allDesks.sort((a, b) => {
        if (a.deskNumber !== null && b.deskNumber !== null) {
          return a.deskNumber - b.deskNumber;
        }
        const aTitle = a.title || '';
        const bTitle = b.title || '';
        return aTitle.localeCompare(bTitle);
      });

      return allDesks;
    } catch (error) {
      throw new Error('Failed to parse floor configuration JSON');
    }
  }

  /**
   * Get all available desks with parsed information
   */
  async getAvailableDesks(workspaceId: string, groupId: string): Promise<DeskInfo[]> {
    try {
      const floorConfigResponse = await this.getFloorConfig(workspaceId, groupId);

      if (!floorConfigResponse.data?.floorConfig) {
        throw new Error('No floor configuration data received');
      }

      return this.parseFloorConfig(floorConfigResponse.data.floorConfig);
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getAvailableDesks');
    }
  }

  /**
   * Find zone ID for a desk by desk number
   */
  async findDeskZoneId(deskNumber: number, workspaceId: string, groupId: string): Promise<number | null> {
    try {
      const desks = await this.getAvailableDesks(workspaceId, groupId);
      const desk = desks.find(d => d.deskNumber === deskNumber);

      if (desk) {
        return parseInt(desk.zoneId);
      }

      return null;
    } catch (error: unknown) {
      return null;
    }
  }

  /**
   * Auto-discover workspace ID from user data or company workspaces
   */
  async discoverWorkspaceId(userApi: any, companyId?: string): Promise<string> {
    try {
      // Strategy 1: Get from user's primary office
      const userData = await userApi.getCurrentUser();
      if (userData.primaryOfficeId) {
        return userData.primaryOfficeId;
      }

      // Strategy 2: Get first accessible office
      if (userData.accessibleOfficeIds && userData.accessibleOfficeIds.length > 0) {
        return userData.accessibleOfficeIds[0];
      }

      // Strategy 3: Discover from company workspaces
      const userCompanyId = companyId || userData.companyId;
      if (userCompanyId) {
        const workspacesData = await this.getInternalWorkspaces(userCompanyId);
        const activeWorkspace = workspacesData.results?.find(ws => ws.isActive && !ws.isClosed);

        if (activeWorkspace?.id) {
          return activeWorkspace.id;
        }
      }

      throw new Error('Could not discover workspace ID using any strategy');
    } catch (error: unknown) {
      handleDeskbirdException(error, 'discoverWorkspaceId');
    }
  }

  /**
   * Auto-discover group ID for a workspace
   */
  async discoverGroupId(workspaceId: string, userApi: any): Promise<string> {
    try {
      // Strategy 1: Try to derive it from user's favorite resources
      const userData = await userApi.getCurrentUser();
      if (userData.favoriteResources && userData.favoriteResources.length > 0) {
        return userData.favoriteResources[0].groupId;
      }

      // Strategy 2: Try to discover groups for this workspace
      const groupsData = await this.getWorkspaceGroups(workspaceId);
      // Look for an active group with floor config
      const activeGroup = groupsData.results?.find(group =>
        group.isActive && group.floorConfigReady
      ) || groupsData.results?.[0]; // fallback to first group

      if (activeGroup) {
        return activeGroup.id;
      }

      throw new Error('Could not determine a group ID for floor configuration');
    } catch (error: unknown) {
      handleDeskbirdException(error, 'discoverGroupId');
    }
  }
}
