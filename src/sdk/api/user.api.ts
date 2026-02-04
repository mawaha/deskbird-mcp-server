import type { FavoriteResource, UserResponse } from '../types/index.js';
import { getVersionedEndpoint } from '../utils/api-paths.js';
import { handleDeskbirdException } from '../utils/error-handler.js';
import type { HttpClient } from '../utils/http-client.js';

/**
 * User details interface used for both search results and individual user data
 * (both endpoints return the same user structure)
 */
export interface UserDetails {
  id: string;
  uuid: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  primaryOfficeId: string;
  avatarColor?: string;
  profileImage?: string;
}

/**
 * User search response type (from API)
 */
export interface UserSearchResponse {
  data: UserDetails[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * User API client for user-related operations
 */
export class UserApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<UserResponse> {

    try {
      const response = await this.client.get<UserResponse>(
        getVersionedEndpoint('USER_PROFILE', '/user')
      );

      if (!response.success || !response.data) {
        throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getCurrentUser');
    }
  }

  /**
   * Get user's favorite resources
   */
  async getUserFavorites(): Promise<FavoriteResource[]> {

    try {
      const userData = await this.getCurrentUser();
      return userData.favoriteResources || [];
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getUserFavorites');
    }
  }

  /**
   * Get user profile summary with key information
   */
  async getUserProfile(): Promise<{
    profile: {
      name: string;
      email: string;
      id: string;
    };
    office: {
      primaryOfficeId: string;
      accessibleOffices: number;
      role: string;
    };
    preferences: {
      language: string;
      hourFormat: string;
      timeZone: string;
      calendarInvites: boolean;
    };
    activity: {
      favoriteDesksCount: number;
      accountCreated: string;
      lastUpdated: string;
    };
    account: {
      status: string;
      isDemoUser: boolean;
      profileType: string;
      allowNameChange: boolean;
    };
    workSetup: {
      userGroupIds: number;
      hybridWorkPolicy: string;
      dedicatedResources: number;
      externalProvider: string;
    };
  }> {

    try {
      const userData = await this.getCurrentUser();

      return {
        profile: {
          name: `${userData.firstName} ${userData.lastName}`,
          email: userData.email || '',
          id: userData.id || '',
        },
        office: {
          primaryOfficeId: userData.primaryOfficeId,
          accessibleOffices: userData.accessibleOfficeIds?.length || 0,
          role: userData.role,
        },
        preferences: {
          language: userData.language,
          hourFormat: userData.hourFormat,
          timeZone: userData.favoriteResources?.[0]?.timeZone || 'Unknown',
          calendarInvites: userData.userSettings?.enableCalendarInvites || false,
        },
        activity: {
          favoriteDesksCount: userData.favoriteResources?.length || 0,
          accountCreated: new Date(userData.createdAt).toLocaleDateString(),
          lastUpdated: new Date(userData.updatedAt).toLocaleDateString(),
        },
        account: {
          status: userData.status,
          isDemoUser: userData.demoUser,
          profileType: userData.profileType,
          allowNameChange: userData.allowNameChange,
        },
        workSetup: {
          userGroupIds: userData.userGroupIds?.length || 0,
          hybridWorkPolicy: userData.hybridWorkPolicyId ? 'Enabled' : 'Not set',
          dedicatedResources: userData.dedicatedResources?.length || 0,
          externalProvider: userData.externalUserData?.provider || 'Unknown',
        },
      };
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getUserProfile');
    }
  }

  /**
   * Search for users in the company
   */
  async searchUsers(params: {
    searchQuery: string;
    companyId: number;
    offset?: number;
    limit?: number;
    sortField?: string;
    sortOrder?: 'ASC' | 'DESC';
    excludeUserIds?: string;
  }): Promise<UserSearchResponse> {

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('searchQuery', params.searchQuery);
      queryParams.append('companyId', params.companyId.toString());
      queryParams.append('offset', (params.offset || 0).toString());
      queryParams.append('limit', (params.limit || 30).toString());
      queryParams.append('sortField', params.sortField || 'userName');
      queryParams.append('sortOrder', params.sortOrder || 'ASC');

      if (params.excludeUserIds) {
        queryParams.append('excludeUserIds', params.excludeUserIds);
      }

      // Build the full path with query parameters
      const basePath = getVersionedEndpoint('USER_SEARCH', '/users');
      const fullPath = `${basePath}?${queryParams.toString()}`;

      const response = await this.client.get<UserSearchResponse>(fullPath);

      if (!response.success) {
        throw new Error(`Failed to search users: ${response.status} ${response.statusText}`);
      }

      return response.data || { data: [], total: 0, offset: 0, limit: 0 };
    } catch (error: unknown) {
      handleDeskbirdException(error, 'searchUsers');
    }
  }

  /**
   * Get detailed user information by user ID
   */
  async getUserById(userId: string): Promise<UserDetails> {

    try {
      // We will always return the full profile, so no ?basicInfo query param
      const endpointPath = getVersionedEndpoint('USER_DETAILS', `/user/${userId}`);

      const response = await this.client.get<UserDetails>(endpointPath);

      if (!response.success || !response.data) {
        throw new Error(`Failed to get user details: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getUserById');
    }
  }

  /**
   * Send a follow request to a user
   */
  async followUser(userId: string): Promise<any> {

    try {
      const response = await this.client.post(
        getVersionedEndpoint('USER_FOLLOW_REQUEST', '/user/followRequest'),
        { userId }
      );

      if (!response.success) {
        throw new Error(`Failed to follow user: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'followUser');
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(userId: string): Promise<any> {

    try {
      const response = await this.client.delete(
        getVersionedEndpoint('USER_UNFOLLOW', `/user/favourites/${userId}`)
      );

      if (!response.success) {
        throw new Error(`Failed to unfollow user: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'unfollowUser');
    }
  }
}
