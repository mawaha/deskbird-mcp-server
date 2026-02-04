import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type CallToolResult,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { createDeskbirdClient, type DeskbirdSdk } from './sdk/index.js';
import { DateUtils } from './sdk/utils/date-utils.js';
import { createLogger } from './utils/logger.js';
import * as dotenvFlow from 'dotenv-flow';

// Load environment variables
dotenvFlow.config();

// --- Tool Definitions ---
const BOOK_DESK_TOOL: Tool = {
  name: 'deskbird_book_desk',
  description: 'Books a desk at the office for a specific date.',
  inputSchema: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        description: 'The date to book the desk in YYYY-MM-DD format.',
      },
      desk_id: {
        type: 'number',
        description: 'The ID of the specific desk (zone item ID) to book.',
      },
    },
    required: ['date', 'desk_id'],
  },
};

const GET_USER_BOOKINGS_TOOL: Tool = {
  name: 'deskbird_get_user_bookings',
  description: 'Retrieves a list of the current user\'s desk bookings with optional filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      skip: {
        type: 'number',
        description: 'Number of bookings to skip for pagination. Defaults to 0.',
        default: 0,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of bookings to return. Defaults to 10.',
        default: 10,
      },
      include_instances: {
        type: 'boolean',
        description: 'Whether to include booking instances. Defaults to true.',
        default: true,
      },
      upcoming: {
        type: 'boolean',
        description: 'Filter to show only upcoming bookings. Defaults to true.',
        default: true,
      },
    },
  },
};

const FAVORITE_DESK_TOOL: Tool = {
  name: "deskbird_favorite_desk",
  description: 'Adds a desk to the users favorite desks list.',
  inputSchema: {
    type: 'object',
    properties: {
      desk_id: {
        type: 'number',
        description: 'The desk number (e.g., 57 for Desk 57) - NOT the internal resource/zone ID. Use the desk number that appears in the desk title.',
      },
    },
    required: ['desk_id'],
  },
};

const UNFAVORITE_DESK_TOOL: Tool = {
  name: 'deskbird_unfavorite_desk',
  description: 'Removes a desk from the users favorite desks list.',
  inputSchema: {
    type: 'object',
    properties: {
      desk_id: {
        type: 'number',
        description: 'The desk number (e.g., 57 for Desk 57) - NOT the internal resource/zone ID. Use the desk number that appears in the desk title.',
      },
    },
    required: ['desk_id'],
  },
};

const GET_USER_FAVORITES_TOOL: Tool = {
  name: 'deskbird_get_user_favorites',
  description: 'Retrieves the user\'s current favorite desks list with desk details including names, locations, and IDs.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const GET_USER_INFO_TOOL: Tool = {
  name: "deskbird_get_user_info",
  description: 'Retrieves the current user\'s profile information including name, office, settings, and account details.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const GET_AVAILABLE_DESKS_TOOL: Tool = {
  name: "deskbird_get_available_desks",
  description: 'Retrieves a list of all available desks from the floor configuration. Shows both desk numbers (used for favoriting) and internal resource IDs. Use the desk number (e.g., 57) for favoriting, not the internal ID.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const DESKBIRD_API_CALL_TOOL: Tool = {
  name: 'deskbird_api_call',
  description: '⚠️ PREVIEW TOOL: Execute any HTTP request to the Deskbird API with full control over path, method, headers, and body. This tool provides direct access to the Deskbird API for advanced users and debugging. Use with caution and ensure you understand the API structure. Examples: GET /user, POST /bookings, PATCH /user/favoriteResource.',
  inputSchema: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        description: 'HTTP method for the API call',
      },
      path: {
        type: 'string',
        description: 'API endpoint path (without base URL). Examples: "/user", "/bookings", "/user/favoriteResource", "/company/internalWorkspaces"',
      },
      api_version: {
        type: 'string',
        description: 'API version to use (optional). Defaults to "v1.1". Examples: "v1.1", "v3". Some endpoints require specific versions.',
        default: 'v1.1'
      },
      body: {
        type: 'object',
        description: 'Request body for POST/PUT/PATCH requests (optional for GET/DELETE). Must be a valid JSON object.',
      },
      query_params: {
        type: 'object',
        additionalProperties: {
          type: ['string', 'number', 'boolean']
        },
        description: 'URL query parameters as key-value pairs (optional). Example: {"skip": 0, "limit": 10}',
      },
      headers: {
        type: 'object',
        additionalProperties: {
          type: 'string'
        },
        description: 'Additional HTTP headers (optional). Authorization header is automatically added. Example: {"Content-Type": "application/json"}',
      }
    },
    required: ['method', 'path']
  }
};

const SEARCH_USERS_TOOL: Tool = {
  name: 'deskbird_search_users',
  description: 'Search for users within the company by name, email, or other criteria.',
  inputSchema: {
    type: 'object',
    properties: {
      search_query: {
        type: 'string',
        description: 'Search query to find users (searches names, emails, etc.)',
      },
      company_id: {
        type: 'number',
        description: 'Company ID to search within. If not provided, will be automatically determined from the current user or environment configuration.',
      },
      offset: {
        type: 'number',
        description: 'Number of results to skip for pagination. Defaults to 0.',
        default: 0,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return. Defaults to 30.',
        default: 30,
      },
      sort_field: {
        type: 'string',
        description: 'Field to sort by. Defaults to "userName".',
        default: 'userName',
      },
      sort_order: {
        type: 'string',
        enum: ['ASC', 'DESC'],
        description: 'Sort order. Defaults to "ASC".',
        default: 'ASC',
      },
      exclude_user_ids: {
        type: 'string',
        description: 'Comma-separated list of user IDs to exclude from results.',
      },
    },
    required: ['search_query'],
  },
};

const GET_USER_DETAILS_TOOL: Tool = {
  name: 'deskbird_get_user_details',
  description: 'Get detailed information about a specific user by their user ID.',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The ID of the user to retrieve details for.',
      },
    },
    required: ['user_id'],
  },
};

const GET_STAFF_PLANNING_TOOL: Tool = {
  name: 'deskbird_get_staff_planning',
  description: 'Retrieves staff planning overview for a specified date range, with options to filter by all users or only favorites.',
  inputSchema: {
    type: 'object',
    properties: {
      start_date: {
        type: 'string',
        format: 'date',
        description: 'The start date for the staff planning in YYYY-MM-DD format.',
      },
      days: {
        type: 'number',
        description: 'The number of days to retrieve staff planning for, starting from the start_date.',
      },
      all_users: {
        type: 'boolean',
        description: 'If true, includes all users; otherwise, only shows users in your favorites. Defaults to false.',
        default: false,
      },
      only_favorites: {
        type: 'boolean',
        description: 'If true, filters the results to only show users marked as favorites. Defaults to false.',
        default: false,
      },
    },
    required: ['start_date', 'days'],
  },
};

const FOLLOW_USER_TOOL: Tool = {
  name: 'deskbird_follow_user',
  description: 'Sends a follow request to another user.',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The ID of the user to follow.',
      },
    },
    required: ['user_id'],
  },
};

const UNFOLLOW_USER_TOOL: Tool = {
  name: 'deskbird_unfollow_user',
  description: 'Unfollows a user (removes them from your favorites/followed list).',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The ID of the user to unfollow.',
      },
    },
    required: ['user_id'],
  },
};

const GET_ZONE_AVAILABILITY_TOOL: Tool = {
  name: 'deskbird_get_zone_availability',
  description: 'Get real-time desk availability and occupancy for a zone within a specific time range. Perfect for finding who sits where and when. Enables "office social radar" queries like "Who\'s sitting near me today?" and "Find available desks near my team".',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_id: {
        type: 'string',
        description: 'The workspace/office identifier (e.g., "6817").',
      },
      zone_id: {
        type: 'string',
        description: 'The zone/area identifier (e.g., "70645" for main workspace area).',
      },
      start_time: {
        type: 'number',
        description: 'Start time as Unix timestamp in milliseconds. If not provided and no date specified, defaults to today 7:00 AM.',
      },
      end_time: {
        type: 'number',
        description: 'End time as Unix timestamp in milliseconds. If not provided and no date specified, defaults to today 11:00 PM.',
      },
      date: {
        type: 'string',
        format: 'date',
        description: 'Optional: Date in YYYY-MM-DD format. If provided, automatically generates start/end times for full day (7:00 AM - 11:00 PM). Overrides start_time/end_time if provided.',
      },
    },
    required: ['workspace_id', 'zone_id'],
  },
};

const GET_FLOOR_CONFIG_TOOL: Tool = {
  name: 'deskbird_get_floor_config',
  description: 'Retrieves detailed floor plan configuration including exact desk coordinates and zone layout for spatial analysis. Enables desk proximity calculations and physical office mapping. Use with zone availability data to answer questions about nearby colleagues and optimal desk locations.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_id: {
        type: 'string',
        description: 'The workspace/office identifier (e.g., "6817").',
      },
      group_id: {
        type: 'string',
        description: 'The floor/group identifier within the workspace (e.g., "18507").',
      },
    },
    required: ['workspace_id', 'group_id'],
  },
};

export class DeskbirdMcpServer {
  private readonly mcpServer: Server;
  private deskbirdSdk: DeskbirdSdk | null = null;
  private readonly tools: Tool[];
  private readonly logger;

  private buildToolsList(): Tool[] {
    const coreTools = [
      BOOK_DESK_TOOL,
      GET_USER_BOOKINGS_TOOL,
      FAVORITE_DESK_TOOL,
      UNFAVORITE_DESK_TOOL,
      GET_USER_FAVORITES_TOOL,
      GET_USER_INFO_TOOL,
      GET_AVAILABLE_DESKS_TOOL,
      SEARCH_USERS_TOOL,
      GET_USER_DETAILS_TOOL,
      FOLLOW_USER_TOOL,
      UNFOLLOW_USER_TOOL,
      GET_STAFF_PLANNING_TOOL,
      GET_ZONE_AVAILABILITY_TOOL,
      GET_FLOOR_CONFIG_TOOL,
    ];

    // Check if preview tools are enabled
    const enablePreviewTools = process.env.ENABLE_PREVIEW_TOOLS === 'true' || process.env.ENABLE_PREVIEW_TOOLS === '1';

    if (enablePreviewTools) {
      return [...coreTools, DESKBIRD_API_CALL_TOOL];
    } else {
      return coreTools;
    }
  }

  constructor() {
    this.logger = createLogger('DeskbirdMcpServer');
    this.tools = this.buildToolsList();

    this.mcpServer = new Server(
      {
        name: 'deskbird-mcp-server-sdk',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerRequestHandlers();
  }

  /**
   * Initialize the SDK with environment configuration
   */
  private async initializeSdk(): Promise<DeskbirdSdk> {
    if (this.deskbirdSdk) {
      return this.deskbirdSdk;
    }

    // Validate environment variables
    const refreshToken = process.env.REFRESH_TOKEN;
    const googleApiKey = process.env.GOOGLE_API_KEY;

    if (!refreshToken || !googleApiKey) {
      throw new Error(
        'Missing required environment variables: REFRESH_TOKEN and GOOGLE_API_KEY'
      );
    }

    // Create SDK client
    this.deskbirdSdk = createDeskbirdClient({
      refreshToken,
      googleApiKey,
      defaultWorkspaceId: process.env.DESKBIRD_WORKSPACE_ID,
      defaultResourceId: process.env.DESKBIRD_RESOURCE_ID,
      defaultGroupId: process.env.DESKBIRD_GROUP_ID,
      defaultCompanyId: process.env.DEFAULT_COMPANY_ID,
      enableRequestLogging: process.env.NODE_ENV === 'development',
    });

    // Initialize the SDK
    await this.deskbirdSdk.initialize();

    return this.deskbirdSdk;
  }

  private registerRequestHandlers(): void {
    // Handler for ListToolsRequest
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Received ListToolsRequest');
      return {
        tools: this.tools,
      };
    });

    // Handler for CallToolRequest
    this.mcpServer.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        this.logger.debug(`Received CallToolRequest for tool: ${request.params.name}`);

        if (request.params.name === BOOK_DESK_TOOL.name) {
          return this.handleBookDeskWithSdk(request);
        } else if (request.params.name === GET_USER_BOOKINGS_TOOL.name) {
          return this.handleGetUserBookingsWithSdk(request);
        } else if (request.params.name === FAVORITE_DESK_TOOL.name) {
          return this.handleFavoriteDeskWithSdk(request);
        } else if (request.params.name === UNFAVORITE_DESK_TOOL.name) {
          return this.handleUnfavoriteDeskWithSdk(request);
        } else if (request.params.name === GET_USER_FAVORITES_TOOL.name) {
          return this.handleGetUserFavoritesWithSdk(request);
        } else if (request.params.name === GET_USER_INFO_TOOL.name) {
          return this.handleGetUserInfoWithSdk(request);
        } else if (request.params.name === GET_AVAILABLE_DESKS_TOOL.name) {
          return this.handleGetAvailableDesksWithSdk(request);
        } else if (request.params.name === DESKBIRD_API_CALL_TOOL.name) {
          // Check if preview tools are enabled
          const enablePreviewTools = process.env.ENABLE_PREVIEW_TOOLS === 'true' || process.env.ENABLE_PREVIEW_TOOLS === '1';
          if (!enablePreviewTools) {
            throw new Error(`Tool '${DESKBIRD_API_CALL_TOOL.name}' is not available. Set ENABLE_PREVIEW_TOOLS=true to enable preview tools.`);
          }
          return this.handleDeskbirdApiCallWithSdk(request);
        } else if (request.params.name === SEARCH_USERS_TOOL.name) {
          return this.handleSearchUsersWithSdk(request);
        } else if (request.params.name === GET_USER_DETAILS_TOOL.name) {
          return this.handleGetUserDetailsWithSdk(request);
        } else if (request.params.name === FOLLOW_USER_TOOL.name) {
          return this.handleFollowUserWithSdk(request);
        } else if (request.params.name === UNFOLLOW_USER_TOOL.name) {
          return this.handleUnfollowUserWithSdk(request);
        } else if (request.params.name === GET_STAFF_PLANNING_TOOL.name) {
          return this.handleGetStaffPlanningWithSdk(request);
        } else if (request.params.name === GET_ZONE_AVAILABILITY_TOOL.name) {
          return this.handleGetZoneAvailabilityWithSdk(request);
        } else if (request.params.name === GET_FLOOR_CONFIG_TOOL.name) {
          return this.handleGetFloorConfigWithSdk(request);
        } else {
          throw new Error(`Unknown tool: ${request.params.name}`);
        }
      }
    );
  }

  private async handleBookDeskWithSdk(request: any): Promise<any> {
    this.logger.debug("Executing tool 'deskbird_book_desk' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments;

      // Validate date
      const dateValidation = DateUtils.validateBookingDate(params.date);
      if (!dateValidation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Booking validation failed: ${dateValidation.errors.join(', ')}`
          }],
          isError: true,
        };
      }

      // Use SDK's high-level booking method
      const result = await sdk.bookDesk({
        deskNumber: params.desk_id,
        date: params.date,
      });

      const successfulCount = result.successfulBookings?.length || 0;
      const failedCount = result.failedBookings?.length || 0;
      const message = `Booking process complete. Successful: ${successfulCount}, Failed: ${failedCount}.`;

      return {
        content: [{
          type: 'text',
          text: `Desk booking completed successfully! ${message}\\n\\nDetails:\\n${JSON.stringify(result, null, 2)}`
        }],
      };
    } catch (error) {
      this.logger.error('Error in handleBookDeskWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleGetUserBookingsWithSdk(request: any): Promise<any> {
    this.logger.debug("Executing tool 'deskbird_get_user_bookings' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments || {};

      // Use SDK's bookings API
      const responseData = await sdk.bookings.getUserBookings({
        skip: params.skip ?? 0,
        limit: params.limit ?? 10,
        include_instances: params.include_instances ?? true,
        upcoming: params.upcoming ?? true,
      });

      const result = {
        success: responseData.success || true,
        message: `Retrieved ${responseData.currentCount || 0} bookings (${responseData.totalCount || 0} total available).`,
        pagination: {
          totalCount: responseData.totalCount,
          currentCount: responseData.currentCount,
          maximumCountPerPage: responseData.maximumCountPerPage,
          next: responseData.next,
          previous: responseData.previous,
        },
        bookings: responseData.results || [],
      };

      return {
        content: [{
          type: 'text',
          text: `Retrieved ${responseData.currentCount || 0} bookings (${responseData.totalCount || 0} total available).\\n\\nBookings Summary:\\n${JSON.stringify(result, null, 2)}`
        }],
      };
    } catch (error) {
      this.logger.error('Error in handleGetUserBookingsWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleFavoriteDeskWithSdk(request: any): Promise<any> {
    this.logger.debug("Executing tool 'deskbird_favorite_desk' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments;

      if (!params.desk_id) {
        throw new Error("Missing required parameter: 'desk_id'");
      }

      // Use SDK's high-level favorite method
      const responseData = await sdk.favoriteDeskByNumber(params.desk_id);

      const deskName = responseData.data?.name || `Desk ${params.desk_id}`;
      const result = {
        success: responseData.success,
        message: `Desk "${deskName}" (Desk ID: ${params.desk_id}) has been added to your favorites.`,
        details: responseData.data || responseData,
      };

      return {
        content: [{
          type: 'text',
          text: `Desk favorited successfully! ${result.message}\\n\\nDetails:\\n${JSON.stringify(result, null, 2)}`
        }],
      };
    } catch (error) {
      this.logger.error('Error in handleFavoriteDeskWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleUnfavoriteDeskWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_unfavorite_desk' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments as any;

      if (!params.desk_id) {
        throw new Error("Missing required parameter: 'desk_id'");
      }

      // Use SDK's high-level unfavorite method
      const responseData = await sdk.unfavoriteDeskByNumber(params.desk_id);

      const result = {
        success: responseData.success,
        message: `Desk ${params.desk_id} has been removed from your favorites.`,
        details: responseData,
      };

      return {
        content: [{
          type: 'text',
          text: `Desk unfavorited successfully! ${result.message}\n\nDetails:\n${JSON.stringify(result, null, 2)}`
        }],
      };
    } catch (error) {
      this.logger.error('Error in handleUnfavoriteDeskWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleGetUserFavoritesWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_get_user_favorites' with SDK");

    try {
      const sdk = await this.initializeSdk();

      // Get user favorites using SDK
      const userData = await sdk.user.getCurrentUser();
      const favoriteResources = userData.favoriteResources || [];

      // Get available desks to enhance favorites with desk numbers
      const allDesks = await sdk.getAvailableDesks();
      const deskMapping: Record<number, number> = {};

      // Create mapping from zone ID to desk number
      allDesks.forEach(desk => {
        if (desk.zoneId && desk.deskNumber !== null) {
          deskMapping[parseInt(desk.zoneId)] = desk.deskNumber;
        }
      });

      // Enhance favorite resources with desk numbers
      const enhancedFavorites = favoriteResources.map(fav => ({
        ...fav,
        deskNumber: deskMapping[fav.id] || null,
      }));

      const result = {
        success: true,
        message: `Retrieved ${favoriteResources.length} favorite desks.`,
        user: {
          id: userData.id,
          name: `${userData.firstName} ${userData.lastName}`,
          email: userData.email,
        },
        favoriteCount: favoriteResources.length,
        favorites: enhancedFavorites,
      };

      return {
        content: [{
          type: 'text',
          text: `Retrieved ${favoriteResources.length} favorite desks.\n\nUser: ${userData.firstName} ${userData.lastName} (${userData.email})\n\nFavorite Desks:\n${JSON.stringify(enhancedFavorites, null, 2)}`
        }],
      };
    } catch (error) {
      this.logger.error('Error in handleGetUserFavoritesWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleGetUserInfoWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_get_user_info' with SDK");

    try {
      const sdk = await this.initializeSdk();

      // Get user data using SDK
      const userData = await sdk.user.getCurrentUser();

      // Extract meaningful user information
      const userInfo = {
        profile: {
          name: `${userData.firstName} ${userData.lastName}`,
          email: userData.email,
          id: userData.id,
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
        }
      };

      const result = {
        success: true,
        message: `Retrieved user information for ${userData.firstName} ${userData.lastName}`,
        user: userInfo,
      };

      return {
        content: [{
          type: 'text',
          text: `User Information Retrieved Successfully!\n\n👤 Profile: ${userInfo.profile.name} (${userInfo.profile.email})\n🏢 Office: Primary Office ID ${userInfo.office.primaryOfficeId} | Role: ${userInfo.office.role}\n⭐ Favorites: ${userInfo.activity.favoriteDesksCount} desk(s)\n🌍 Preferences: ${userInfo.preferences.language} | ${userInfo.preferences.hourFormat} | Calendar invites: ${userInfo.preferences.calendarInvites ? 'Yes' : 'No'}\n📅 Account: Created ${userInfo.activity.accountCreated} | Status: ${userInfo.account.status}\n👥 Work Setup: ${userInfo.workSetup.userGroupIds} groups | Provider: ${userInfo.workSetup.externalProvider}\n\nDetailed Info:\n${JSON.stringify(result, null, 2)}`
        }],
      };
    } catch (error) {
      this.logger.error('Error in handleGetUserInfoWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleGetAvailableDesksWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_get_available_desks' with SDK");

    try {
      const sdk = await this.initializeSdk();

      // Use SDK's high-level method
      const allDesks = await sdk.getAvailableDesks();

      const resultText = allDesks.length > 0
        ? `Found ${allDesks.length} available desks:\n\n${allDesks.map(desk => {
            const favoriteId = desk.deskNumber !== null ? `Desk #${desk.deskNumber}` : `Internal ID: ${desk.id}`;
            return `• **${desk.title}** (${favoriteId}) - Zone ID: ${desk.zoneId} - Area: ${desk.areaName} - Status: ${desk.status}${desk.deskNumber !== null ? '\n  ↳ *Use desk number ' + desk.deskNumber + ' for favoriting*' : ''}`;
          }).join('\n\n')}`
        : 'No desks found in the floor configuration.';

      return {
        content: [{
          type: 'text',
          text: resultText
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleGetAvailableDesksWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleDeskbirdApiCallWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_api_call' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments as any;

      if (!params.method || !params.path) {
        throw new Error("Missing required parameters: 'method' and 'path'");
      }

      // Validate path format
      if (params.path.startsWith('http://') || params.path.startsWith('https://')) {
        throw new Error("Path must be relative (e.g., '/user'), not an absolute URL");
      }

      // Use SDK's generic API call method
      // If api_version is provided, prepend it to the path
      let finalPath = params.path;
      if (params.api_version && !params.path.match(/^\/v\d+(\.\d+)?/)) {
        // Build versioned path manually if api_version is specified
        const version = params.api_version.startsWith('v') ? params.api_version : `v${params.api_version}`;
        finalPath = `/${version}${params.path.startsWith('/') ? params.path : `/${params.path}`}`;
      }

      const responseData = await sdk.apiCall(
        params.method,
        finalPath,
        params.body,
        params.query_params,
        params.headers
      );

      const statusEmoji = '✅';
      const formattedResponse = `${statusEmoji} **API Call Completed**\n\n**Request:** ${params.method} ${params.path}\n**Status:** Success\n\n**Response Data:**\n${JSON.stringify(responseData, null, 2)}`;

      return {
        content: [{
          type: 'text',
          text: formattedResponse
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleDeskbirdApiCallWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `❌ **API Call Failed**\n\nError: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * Handle user search using the SDK
   */
  private async handleSearchUsersWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_search_users' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments as any;

      if (!params?.search_query) {
        throw new Error("Missing required parameter: 'search_query'");
      }

      // Use SDK's user search method with dynamic company ID
      const responseData = await sdk.searchUsers({
        searchQuery: params.search_query,
        companyId: params.company_id, // Will be auto-discovered if not provided
        offset: params.offset ?? 0,
        limit: params.limit ?? 30,
        sortField: params.sort_field ?? 'userName',
        sortOrder: params.sort_order ?? 'ASC',
        excludeUserIds: params.exclude_user_ids,
      });

      const result = {
        success: true,
        message: `Found ${responseData.data.length} user(s) matching your search.`,
        total: responseData.total,
        users: responseData.data,
      };

      return {
        content: [{
          type: 'text',
          text: `User Search Results:\n\n${result.message}\n\n${result.users.map(user => `• ${user.firstName} ${user.lastName} (${user.email}) - ID: ${user.id}`).join('\n')}\n\nTotal: ${result.total} users found`
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleSearchUsersWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * Handle getting user details using the SDK
   */
  private async handleGetUserDetailsWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_get_user_details' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments as any;

      if (!params?.user_id) {
        throw new Error("Missing required parameter: 'user_id'");
      }

      // Use SDK's user details method
      const responseData = await sdk.user.getUserById(params.user_id);

      const result = {
        success: true,
        message: `Retrieved details for user ${responseData.firstName} ${responseData.lastName}`,
        user: responseData,
      };

      return {
        content: [{
          type: 'text',
          text: `User Details Retrieved Successfully!\n\n👤 **${responseData.firstName} ${responseData.lastName}**\n📧 Email: ${responseData.email}\n🆔 User ID: ${responseData.id}\n🏢 Company ID: ${responseData.companyId}\n🏢 Office ID: ${responseData.primaryOfficeId}\n🎨 Avatar Color: ${responseData.avatarColor}\n🖼️ Profile Image: ${responseData.profileImage || 'None'}\n\nDetailed Info:\n${JSON.stringify(result, null, 2)}`
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleGetUserDetailsWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * Handle following a user using the SDK
   */
  private async handleFollowUserWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_follow_user' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments as any;

      if (!params?.user_id) {
        throw new Error("Missing required parameter: 'user_id'");
      }

      // Use SDK's user API for followUser
      const responseData = await sdk.user.followUser(params.user_id);

      const result = {
        success: true,
        message: `Successfully sent follow request to user ID: ${params.user_id}`,
        details: responseData,
      };

      return {
        content: [{
          type: 'text',
          text: `Follow User Request Sent!\n\n${result.message}\n\nDetails:\n${JSON.stringify(result, null, 2)}`
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleFollowUserWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * Handle unfollowing a user using the SDK
   */
  private async handleUnfollowUserWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_unfollow_user' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments as any;

      if (!params?.user_id) {
        throw new Error("Missing required parameter: 'user_id'");
      }

      // Use SDK's user API for unfollowUser
      const responseData = await sdk.user.unfollowUser(params.user_id);

      const result = {
        success: true,
        message: `Successfully unfollowed user ID: ${params.user_id}`,
        details: responseData,
      };

      return {
        content: [{
          type: 'text',
          text: `User Unfollowed Successfully!\n\n${result.message}\n\nDetails:\n${JSON.stringify(result, null, 2)}`
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleUnfollowUserWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  /**
   * Handle getting staff planning using the SDK
   */
  private async handleGetStaffPlanningWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_get_staff_planning' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments as any;

      if (!params?.start_date || params?.days === undefined) {
        throw new Error("Missing required parameters: 'start_date' and 'days'");
      }

      const responseData = await sdk.scheduling.getStaffPlanning({
        startDate: params.start_date,
        days: params.days,
        all: params.all_users,
        favorites: params.only_favorites,
      });

      const result = {
        success: true,
        message: `Retrieved staff planning for ${params.days} days starting from ${params.start_date}.`,
        data: responseData,
      };

      return {
        content: [{
          type: 'text',
          text: `Staff Planning Retrieved Successfully!\n\n${result.message}\n\nDetails:\n${JSON.stringify(result, null, 2)}`
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleGetStaffPlanningWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleGetZoneAvailabilityWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_get_zone_availability' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments;

      // Validate required parameters
      if (!params || !params.workspace_id || !params.zone_id) {
        throw new Error('workspace_id and zone_id are required parameters');
      }

      // Handle time range generation
      let startTime = params.start_time as number | undefined;
      let endTime = params.end_time as number | undefined;

      if (params.date) {
        // Generate full day range from date (7 AM to 11 PM Europe/Amsterdam)
        const { startTime: dayStart, endTime: dayEnd } = DateUtils.generateDayTimeRange(params.date as string);
        startTime = dayStart;
        endTime = dayEnd;
      } else if (!startTime || !endTime) {
        // Default to today if no time range specified
        const today = DateUtils.getTodayDateString();
        const { startTime: dayStart, endTime: dayEnd } = DateUtils.generateDayTimeRange(today);
        startTime = dayStart;
        endTime = dayEnd;
      }

      this.logger.debug(`Getting zone availability for workspace ${params.workspace_id}, zone ${params.zone_id}, time range: ${startTime} - ${endTime}`);

      const result = await sdk.getZoneAvailability({
        workspaceId: params.workspace_id as string,
        zoneId: params.zone_id as string,
        startTime: startTime!,
        endTime: endTime!
      });

      return {
        content: [{
          type: 'text',
          text: `Zone Availability Retrieved Successfully!\n\nZone: ${result.name} (${result.type})\nCapacity: ${result.capacity} desks\nCurrently Available: ${result.totalAvailable} desks\nCurrently Occupied: ${result.availability.used} desks\nActive Users: ${result.availability.users.length}\n\nDetailed occupancy and availability data:\n${JSON.stringify(result, null, 2)}`
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleGetZoneAvailabilityWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  private async handleGetFloorConfigWithSdk(request: CallToolRequest): Promise<CallToolResult> {
    this.logger.debug("Executing tool 'deskbird_get_floor_config' with SDK");

    try {
      const sdk = await this.initializeSdk();
      const params = request.params.arguments;

      // Validate required parameters
      if (!params || !params.workspace_id || !params.group_id) {
        throw new Error('workspace_id and group_id are required parameters');
      }

      this.logger.debug(`Getting floor config for workspace ${params.workspace_id}, group ${params.group_id}`);

      const result = await sdk.getFloorConfig({
        workspaceId: params.workspace_id as string,
        groupId: params.group_id as string
      });

      // Parse the floor config to provide more readable information
      const floorLayout = result.floorConfig ? JSON.parse(result.floorConfig) : null;
      const deskCount = floorLayout?.areas[0]?.desks?.length || 0;
      const zoneName = floorLayout?.areas[0]?.title || 'Unknown';

      return {
        content: [{
          type: 'text',
          text: `Floor Configuration Retrieved Successfully!\n\nFloor: ${result.name}\nZone: ${zoneName}\nTotal Desks: ${deskCount}\nConfiguration Ready: ${result.floorConfigReady}\nInteractive Image Available: ${!!result.interactiveImage}\n\nFloor layout includes desk coordinates, zone boundaries, and spatial mapping data.\n\nFull configuration data:\n${JSON.stringify(result, null, 2)}`
        }],
        isError: false,
      };
    } catch (error) {
      this.logger.error('Error in handleGetFloorConfigWithSdk', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  // --- Public Connection Methods ---

  public async connect(transport: Transport): Promise<void> {
    await this.mcpServer.connect(transport);
    this.logger.info('Deskbird MCP Server (SDK-based) connected and running.');
  }

  public async close(): Promise<void> {
    await this.mcpServer.close();
    this.logger.info('Deskbird MCP Server (SDK-based) closed.');
  }
}
