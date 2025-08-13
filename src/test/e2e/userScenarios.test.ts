/**
 * End-to-End Tests for AI Chain Traversal Tools
 * Tests complete user scenarios and real-world workflows
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { InitializeSessionTool } from '../../tools/initializeSessionTool';
import { AddEntityTool } from '../../tools/addEntityTool';
import { AddRelationshipTool } from '../../tools/addRelationshipTool';
import { GetNextWorkItemTool } from '../../tools/getNextWorkItemTool';
import { MarkProcessedTool } from '../../tools/markProcessedTool';
import { ValidateChainsTool } from '../../tools/validateChainsTool';
import { GenerateReportTool } from '../../tools/generateReportTool';
import { CoordinateAgentsTool } from '../../tools/coordinateAgentsTool';
import { RecoverContextTool } from '../../tools/recoverContextTool';
import { TestDataFactory, VSCodeMocks } from '../utils/testUtils';

describe('End-to-End User Scenarios', () => {
  let context: vscode.ExtensionContext;
  let tools: {
    initialize: InitializeSessionTool;
    addEntity: AddEntityTool;
    addRelationship: AddRelationshipTool;
    getWorkItem: GetNextWorkItemTool;
    markProcessed: MarkProcessedTool;
    validate: ValidateChainsTool;
    report: GenerateReportTool;
    coordinate: CoordinateAgentsTool;
    recover: RecoverContextTool;
  };

  beforeEach(() => {
    context = TestDataFactory.createMockContext();
    tools = {
      initialize: new InitializeSessionTool(context),
      addEntity: new AddEntityTool(context),
      addRelationship: new AddRelationshipTool(context),
      getWorkItem: new GetNextWorkItemTool(context),
      markProcessed: new MarkProcessedTool(context),
      validate: new ValidateChainsTool(context),
      report: new GenerateReportTool(context),
      coordinate: new CoordinateAgentsTool(context),
      recover: new RecoverContextTool(context)
    };
  });

  afterEach(() => {
    // Cleanup
    context.globalState.update('currentSession', undefined);
    context.globalState.update('workQueue', undefined);
    context.globalState.update('agentStates', undefined);
  });

  describe('Complete User Management Analysis Scenario', () => {
    it('should analyze complete user management system with authentication flow', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      console.log('🚀 Starting complete user management analysis...');

      // Phase 1: Initialize Analysis Session
      const initResult = await (tools.initialize as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'E2E Test: Complete user management system analysis including authentication, authorization, profile management, and data persistence layers'
        }),
        token
      );

      assert.ok(initResult);
      const initResponse = JSON.parse(initResult.content[0].value);
      assert.strictEqual(initResponse.success, true);
      console.log('✅ Phase 1: Session initialized');

      // Phase 2: Discover Frontend Components
      const frontendEntities = [
        {
          id: 'LoginComponent',
          type: 'Component',
          filePath: '/src/components/auth/LoginComponent.tsx',
          businessContext: 'User login interface with form validation and error handling',
          chainContext: 'Frontend authentication entry point'
        },
        {
          id: 'UserProfileComponent',
          type: 'Component',
          filePath: '/src/components/user/UserProfileComponent.tsx',
          businessContext: 'User profile display and editing interface',
          chainContext: 'Frontend user management interface'
        },
        {
          id: 'UserListComponent',
          type: 'Component',
          filePath: '/src/components/admin/UserListComponent.tsx',
          businessContext: 'Administrative user listing and management',
          chainContext: 'Frontend admin interface'
        }
      ];

      for (const entity of frontendEntities) {
        const result = await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity }),
          token
        );
        assert.ok(result);
        const response = JSON.parse(result.content[0].value);
        assert.strictEqual(response.success, true);
      }
      console.log('✅ Phase 2: Frontend components discovered');

      // Phase 3: Discover API Layer
      const apiEntities = [
        {
          id: 'AuthController',
          type: 'Controller',
          filePath: '/src/api/controllers/AuthController.ts',
          businessContext: 'Authentication endpoints: login, logout, token refresh, password reset',
          chainContext: 'API layer authentication handling'
        },
        {
          id: 'UserController',
          type: 'Controller',
          filePath: '/src/api/controllers/UserController.ts',
          businessContext: 'User CRUD operations and profile management endpoints',
          chainContext: 'API layer user data management'
        },
        {
          id: 'AdminController',
          type: 'Controller',
          filePath: '/src/api/controllers/AdminController.ts',
          businessContext: 'Administrative operations: user management, role assignment',
          chainContext: 'API layer administrative functions'
        }
      ];

      for (const entity of apiEntities) {
        const result = await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity }),
          token
        );
        assert.ok(result);
        const response = JSON.parse(result.content[0].value);
        assert.strictEqual(response.success, true);
      }
      console.log('✅ Phase 3: API layer discovered');

      // Phase 4: Discover Service Layer
      const serviceEntities = [
        {
          id: 'AuthService',
          type: 'Service',
          filePath: '/src/services/AuthService.ts',
          businessContext: 'Authentication business logic: credential validation, token generation, session management',
          chainContext: 'Service layer security processing'
        },
        {
          id: 'UserService',
          type: 'Service',
          filePath: '/src/services/UserService.ts',
          businessContext: 'User business logic: profile validation, data transformation, business rules',
          chainContext: 'Service layer user operations'
        },
        {
          id: 'NotificationService',
          type: 'Service',
          filePath: '/src/services/NotificationService.ts',
          businessContext: 'User notification system: email, SMS, in-app notifications',
          chainContext: 'Service layer communication'
        }
      ];

      for (const entity of serviceEntities) {
        const result = await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity }),
          token
        );
        assert.ok(result);
        const response = JSON.parse(result.content[0].value);
        assert.strictEqual(response.success, true);
      }
      console.log('✅ Phase 4: Service layer discovered');

      // Phase 5: Discover Data Layer
      const dataEntities = [
        {
          id: 'UserRepository',
          type: 'Repository',
          filePath: '/src/data/repositories/UserRepository.ts',
          businessContext: 'User data access: CRUD operations, query optimization, caching',
          chainContext: 'Data layer user persistence'
        },
        {
          id: 'AuthTokenRepository',
          type: 'Repository',
          filePath: '/src/data/repositories/AuthTokenRepository.ts',
          businessContext: 'Authentication token storage and validation',
          chainContext: 'Data layer security persistence'
        },
        {
          id: 'AuditLogRepository',
          type: 'Repository',
          filePath: '/src/data/repositories/AuditLogRepository.ts',
          businessContext: 'User activity logging and audit trail',
          chainContext: 'Data layer compliance and monitoring'
        }
      ];

      for (const entity of dataEntities) {
        const result = await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity }),
          token
        );
        assert.ok(result);
        const response = JSON.parse(result.content[0].value);
        assert.strictEqual(response.success, true);
      }
      console.log('✅ Phase 5: Data layer discovered');

      // Phase 6: Map Component → Controller Relationships
      const frontendApiRelationships = [
        { from: 'LoginComponent', to: 'AuthController', type: 'CALLS' },
        { from: 'UserProfileComponent', to: 'UserController', type: 'CALLS' },
        { from: 'UserListComponent', to: 'AdminController', type: 'CALLS' }
      ];

      for (const rel of frontendApiRelationships) {
        const result = await (tools.addRelationship as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: rel.from,
              toEntityId: rel.to,
              relationshipType: rel.type,
              strength: 0.9,
              discoveryMethod: 'list_code_usages'
            }
          }),
          token
        );
        assert.ok(result);
        const response = JSON.parse(result.content[0].value);
        assert.strictEqual(response.success, true);
      }
      console.log('✅ Phase 6: Frontend-API relationships mapped');

      // Phase 7: Map Controller → Service Relationships
      const apiServiceRelationships = [
        { from: 'AuthController', to: 'AuthService', type: 'USES' },
        { from: 'UserController', to: 'UserService', type: 'USES' },
        { from: 'AdminController', to: 'UserService', type: 'USES' },
        { from: 'UserService', to: 'NotificationService', type: 'USES' }
      ];

      for (const rel of apiServiceRelationships) {
        const result = await (tools.addRelationship as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: rel.from,
              toEntityId: rel.to,
              relationshipType: rel.type,
              strength: 0.8,
              discoveryMethod: 'semantic_search'
            }
          }),
          token
        );
        assert.ok(result);
        const response = JSON.parse(result.content[0].value);
        assert.strictEqual(response.success, true);
      }
      console.log('✅ Phase 7: API-Service relationships mapped');

      // Phase 8: Map Service → Repository Relationships
      const serviceDataRelationships = [
        { from: 'AuthService', to: 'UserRepository', type: 'DEPENDS_ON' },
        { from: 'AuthService', to: 'AuthTokenRepository', type: 'DEPENDS_ON' },
        { from: 'UserService', to: 'UserRepository', type: 'DEPENDS_ON' },
        { from: 'UserService', to: 'AuditLogRepository', type: 'DEPENDS_ON' }
      ];

      for (const rel of serviceDataRelationships) {
        const result = await (tools.addRelationship as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: rel.from,
              toEntityId: rel.to,
              relationshipType: rel.type,
              strength: 0.95,
              discoveryMethod: 'grep_search'
            }
          }),
          token
        );
        assert.ok(result);
        const response = JSON.parse(result.content[0].value);
        assert.strictEqual(response.success, true);
      }
      console.log('✅ Phase 8: Service-Data relationships mapped');

      // Phase 9: Validate Complete Chains
      const validationResult = await (tools.validate as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({}),
        token
      );

      assert.ok(validationResult);
      const validationText = validationResult.content[0].value;
      assert.ok(validationText.includes('validation') || validationText.includes('analysis'));
      console.log('✅ Phase 9: Chain validation completed');

      // Phase 10: Generate Comprehensive Report
      const reportResult = await (tools.report as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          format: 'json',
          includeStatistics: true,
          includeEntityDetails: true,
          includeRelationshipAnalysis: true,
          includeChainAnalysis: true
        }),
        token
      );

      assert.ok(reportResult);
      const reportText = reportResult.content[0].value;
      
      // Verify comprehensive analysis results
      assert.ok(reportText.includes('LoginComponent'), 'Report should include frontend components');
      assert.ok(reportText.includes('AuthController'), 'Report should include API controllers');
      assert.ok(reportText.includes('UserService'), 'Report should include services');
      assert.ok(reportText.includes('UserRepository'), 'Report should include repositories');
      assert.ok(reportText.includes('CALLS') || reportText.includes('USES') || reportText.includes('DEPENDS_ON'), 'Report should include relationships');

      console.log('✅ Phase 10: Comprehensive analysis report generated');
      console.log('🎉 Complete user management analysis scenario completed successfully!');
    });
  });

  describe('Multi-Agent Coordination Scenario', () => {
    it('should coordinate multiple AI agents analyzing different system layers', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      console.log('🚀 Starting multi-agent coordination scenario...');

      // Initialize session for multi-agent analysis
      await (tools.initialize as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'E2E Test: Multi-agent analysis of microservices architecture'
        }),
        token
      );

      // Agent 1: Frontend Analysis Agent
      const frontendAgentId = 'frontend-specialist';
      await (tools.coordinate as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          agentId: frontendAgentId,
          agentRole: 'Frontend Specialist',
          analysisScope: 'React components, state management, UI interactions'
        }),
        token
      );

      // Agent 2: Backend API Agent
      const backendAgentId = 'backend-api-specialist';
      await (tools.coordinate as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          agentId: backendAgentId,
          agentRole: 'Backend API Specialist',
          analysisScope: 'REST endpoints, middleware, authentication'
        }),
        token
      );

      // Agent 3: Database Agent
      const databaseAgentId = 'database-specialist';
      await (tools.coordinate as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          agentId: databaseAgentId,
          agentRole: 'Database Specialist', 
          analysisScope: 'Data models, repositories, query optimization'
        }),
        token
      );

      console.log('✅ Multi-agent coordination established');

      // Simulate agents working in parallel on different system layers
      
      // Frontend Agent discovers UI components
      for (let i = 1; i <= 5; i++) {
        await (tools.getWorkItem as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            priority: 1,
            agentId: frontendAgentId
          }),
          token
        );

        await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entity: {
              id: `FrontendComponent${i}`,
              type: 'Component',
              filePath: `/src/ui/Component${i}.tsx`,
              businessContext: `Frontend component ${i} for user interface`,
              chainContext: `UI layer component ${i}`
            }
          }),
          token
        );

        await (tools.markProcessed as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entityId: `FrontendComponent${i}`,
            agentId: frontendAgentId,
            analysisResults: {
              complexity: 'medium',
              dependencies: [],
              recommendations: ['Add TypeScript types', 'Improve accessibility']
            }
          }),
          token
        );
      }

      // Backend Agent discovers API endpoints
      for (let i = 1; i <= 4; i++) {
        await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entity: {
              id: `APIEndpoint${i}`,
              type: 'Controller',
              filePath: `/src/api/controllers/Controller${i}.ts`,
              businessContext: `API endpoint ${i} for business operations`,
              chainContext: `API layer endpoint ${i}`
            }
          }),
          token
        );

        await (tools.markProcessed as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entityId: `APIEndpoint${i}`,
            agentId: backendAgentId,
            analysisResults: {
              complexity: 'high',
              dependencies: [`Service${i}`],
              recommendations: ['Add input validation', 'Implement rate limiting']
            }
          }),
          token
        );
      }

      // Database Agent discovers data layer
      for (let i = 1; i <= 3; i++) {
        await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entity: {
              id: `DataModel${i}`,
              type: 'Entity',
              filePath: `/src/data/models/Model${i}.ts`,
              businessContext: `Data model ${i} for entity persistence`,
              chainContext: `Data layer model ${i}`
            }
          }),
          token
        );

        await (tools.markProcessed as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entityId: `DataModel${i}`,
            agentId: databaseAgentId,
            analysisResults: {
              complexity: 'medium',
              dependencies: [],
              recommendations: ['Add database indexes', 'Optimize queries']
            }
          }),
          token
        );
      }

      console.log('✅ Multi-agent parallel analysis completed');

      // Coordinate agents to establish cross-layer relationships
      const crossLayerRelationships = [
        { from: 'FrontendComponent1', to: 'APIEndpoint1', type: 'CALLS' },
        { from: 'APIEndpoint1', to: 'DataModel1', type: 'USES' },
        { from: 'FrontendComponent2', to: 'APIEndpoint2', type: 'CALLS' }
      ];

      for (const rel of crossLayerRelationships) {
        await (tools.addRelationship as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: rel.from,
              toEntityId: rel.to,
              relationshipType: rel.type,
              strength: 0.8,
              discoveryMethod: 'multi_agent_correlation'
            }
          }),
          token
        );
      }

      // Generate final coordinated report
      const finalReport = await (tools.report as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          format: 'json',
          includeAgentContributions: true,
          includeCoordinationMetrics: true
        }),
        token
      );

      assert.ok(finalReport);
      const reportText = finalReport.content[0].value;
      
      // Verify multi-agent coordination results
      assert.ok(reportText.includes('FrontendComponent'), 'Report should include frontend analysis');
      assert.ok(reportText.includes('APIEndpoint'), 'Report should include backend analysis');
      assert.ok(reportText.includes('DataModel'), 'Report should include database analysis');

      console.log('✅ Multi-agent coordination and final report completed');
      console.log('🎉 Multi-agent coordination scenario completed successfully!');
    });
  });

  describe('Recovery and Resilience Scenario', () => {
    it('should recover from interruptions and maintain analysis state', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      console.log('🚀 Starting recovery and resilience scenario...');

      // Phase 1: Initial Analysis Setup
      await (tools.initialize as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'E2E Test: Recovery scenario - e-commerce platform analysis'
        }),
        token
      );

      // Add initial entities
      const initialEntities = [
        {
          id: 'ProductCatalog',
          type: 'Service',
          filePath: '/src/catalog/ProductCatalogService.ts',
          businessContext: 'Product catalog management and search',
          chainContext: 'E-commerce product layer'
        },
        {
          id: 'ShoppingCart',
          type: 'Service',
          filePath: '/src/cart/ShoppingCartService.ts',
          businessContext: 'Shopping cart operations and persistence',
          chainContext: 'E-commerce transaction layer'
        },
        {
          id: 'PaymentProcessor',
          type: 'Service',
          filePath: '/src/payment/PaymentProcessor.ts',
          businessContext: 'Payment processing and validation',
          chainContext: 'E-commerce financial layer'
        }
      ];

      for (const entity of initialEntities) {
        await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity }),
          token
        );
      }

      console.log('✅ Initial analysis state established');

      // Simulate interruption - save current session state
      const currentSession = context.globalState.get('currentSession');
      context.globalState.get('discoveredEntities');
      
      console.log('💾 Session state saved before interruption');

      // Simulate system restart/recovery
      context.globalState.update('currentSession', undefined);
      context.globalState.update('discoveredEntities', undefined);

      console.log('🔄 Simulating system interruption...');

      // Phase 2: Context Recovery
      const recoveryResult = await (tools.recover as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          sessionId: (currentSession as any)?.sessionId,
          recoveryScope: 'full'
        }),
        token
      );

      assert.ok(recoveryResult);
      const recoveryResponse = JSON.parse(recoveryResult.content[0].value);
      assert.strictEqual(recoveryResponse.success, true);

      console.log('✅ Context recovery completed');

      // Verify recovered entities are still accessible
      const continueResult = await (tools.addEntity as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          entity: {
            id: 'OrderManagement',
            type: 'Service',
            filePath: '/src/orders/OrderManagementService.ts',
            businessContext: 'Order lifecycle management and tracking',
            chainContext: 'E-commerce order processing layer'
          }
        }),
        token
      );

      assert.ok(continueResult);
      const continueResponse = JSON.parse(continueResult.content[0].value);
      assert.strictEqual(continueResponse.success, true);

      // Add relationships to verify system integrity
      await (tools.addRelationship as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          relationship: {
            fromEntityId: 'ShoppingCart',
            toEntityId: 'OrderManagement',
            relationshipType: 'TRIGGERS',
            strength: 0.9,
            discoveryMethod: 'post_recovery_analysis'
          }
        }),
        token
      );

      // Generate recovery validation report
      const validationReport = await (tools.report as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          format: 'json',
          includeRecoveryMetrics: true
        }),
        token
      );

      assert.ok(validationReport);
      const reportText = validationReport.content[0].value;
      
      // Verify all original entities are still present
      assert.ok(reportText.includes('ProductCatalog'), 'Recovered analysis should include original entities');
      assert.ok(reportText.includes('ShoppingCart'), 'Recovered analysis should include original entities');
      assert.ok(reportText.includes('PaymentProcessor'), 'Recovered analysis should include original entities');
      assert.ok(reportText.includes('OrderManagement'), 'Recovered analysis should include post-recovery entities');

      console.log('✅ Recovery validation completed');
      console.log('🎉 Recovery and resilience scenario completed successfully!');
    });
  });

  describe('Performance at Scale Scenario', () => {
    it('should handle enterprise-scale codebase analysis efficiently', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      console.log('🚀 Starting enterprise-scale performance scenario...');

      // Initialize for large-scale analysis
      await (tools.initialize as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'E2E Test: Enterprise-scale microservices platform analysis with 500+ components'
        }),
        token
      );

      const startTime = Date.now();

      // Simulate enterprise architecture discovery
      const microservices = [
        'user-service', 'auth-service', 'product-service', 'order-service',
        'payment-service', 'inventory-service', 'notification-service', 'analytics-service',
        'reporting-service', 'audit-service', 'logging-service', 'monitoring-service'
      ];

      const componentTypes = ['Controller', 'Service', 'Repository', 'Component', 'Utility'];
      const totalEntities = 200; // Realistic enterprise scale

      console.log(`📊 Analyzing ${totalEntities} entities across ${microservices.length} microservices...`);

      // Phase 1: Bulk Entity Discovery
      const entityBatchSize = 20;
      for (let batch = 0; batch < totalEntities / entityBatchSize; batch++) {
        const batchPromises: Promise<any>[] = [];
        
        for (let i = 0; i < entityBatchSize; i++) {
          const entityIndex = batch * entityBatchSize + i;
          if (entityIndex >= totalEntities) break;

          const microservice = microservices[entityIndex % microservices.length];
          const componentType = componentTypes[entityIndex % componentTypes.length];
          
          const entityPromise = (tools.addEntity as any).executeToolLogic(
            VSCodeMocks.createMockToolInvocationOptions({
              entity: {
                id: `${microservice}_${componentType}_${entityIndex}`,
                type: componentType,
                filePath: `/src/${microservice}/${componentType.toLowerCase()}s/${componentType}${entityIndex}.ts`,
                businessContext: `${componentType} for ${microservice} - handles business logic ${entityIndex}`,
                chainContext: `${microservice} layer - ${componentType.toLowerCase()} processing`
              }
            }),
            token
          );
          
          batchPromises.push(entityPromise);
        }

        await Promise.all(batchPromises);
        
        if ((batch + 1) % 5 === 0) {
          const progress = ((batch + 1) * entityBatchSize / totalEntities * 100).toFixed(1);
          console.log(`⏳ Entity discovery progress: ${progress}%`);
        }
      }

      const discoveryTime = Date.now() - startTime;
      console.log(`✅ Entity discovery completed in ${discoveryTime}ms`);

      // Phase 2: Relationship Mapping
      const relationshipStartTime = Date.now();
      const relationshipCount = totalEntities / 2; // Realistic relationship density
      
      for (let i = 0; i < relationshipCount; i++) {
        const fromService = microservices[i % microservices.length];
        const toService = microservices[(i + 1) % microservices.length];
        const fromType = componentTypes[i % componentTypes.length];
        const toType = componentTypes[(i + 1) % componentTypes.length];
        
        await (tools.addRelationship as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: `${fromService}_${fromType}_${i}`,
              toEntityId: `${toService}_${toType}_${(i + relationshipCount) % totalEntities}`,
              relationshipType: i % 3 === 0 ? 'CALLS' : i % 3 === 1 ? 'USES' : 'DEPENDS_ON',
              strength: 0.5 + (i % 5) * 0.1,
              discoveryMethod: 'enterprise_analysis'
            }
          }),
          token
        );

        if ((i + 1) % 50 === 0) {
          const progress = ((i + 1) / relationshipCount * 100).toFixed(1);
          console.log(`⏳ Relationship mapping progress: ${progress}%`);
        }
      }

      const relationshipTime = Date.now() - relationshipStartTime;
      console.log(`✅ Relationship mapping completed in ${relationshipTime}ms`);

      // Phase 3: Enterprise Validation
      const validationStartTime = Date.now();
      const validationResult = await (tools.validate as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          validationScope: 'enterprise',
          includePerformanceMetrics: true
        }),
        token
      );

      const validationTime = Date.now() - validationStartTime;
      assert.ok(validationResult);
      console.log(`✅ Enterprise validation completed in ${validationTime}ms`);

      // Phase 4: Comprehensive Report Generation
      const reportStartTime = Date.now();
      const finalReport = await (tools.report as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          format: 'json',
          includeStatistics: true,
          includePerformanceMetrics: true,
          includeArchitectureAnalysis: true,
          includeMicroserviceMapping: true
        }),
        token
      );

      const reportTime = Date.now() - reportStartTime;
      assert.ok(finalReport);

      const totalTime = Date.now() - startTime;

      // Performance Assertions
      const avgEntityTime = discoveryTime / totalEntities;
      const avgRelationshipTime = relationshipTime / relationshipCount;

      assert.ok(avgEntityTime < 50, `Entity processing too slow: ${avgEntityTime}ms per entity`);
      assert.ok(avgRelationshipTime < 30, `Relationship processing too slow: ${avgRelationshipTime}ms per relationship`);
      assert.ok(totalTime < 60000, `Total analysis time too slow: ${totalTime}ms for enterprise scale`);

      console.log(`📈 Performance Summary:`);
      console.log(`   • Total entities: ${totalEntities}`);
      console.log(`   • Total relationships: ${relationshipCount}`);
      console.log(`   • Entity discovery: ${discoveryTime}ms (${avgEntityTime.toFixed(2)}ms/entity)`);
      console.log(`   • Relationship mapping: ${relationshipTime}ms (${avgRelationshipTime.toFixed(2)}ms/relationship)`);
      console.log(`   • Validation: ${validationTime}ms`);
      console.log(`   • Report generation: ${reportTime}ms`);
      console.log(`   • Total time: ${totalTime}ms`);

      console.log('🎉 Enterprise-scale performance scenario completed successfully!');
    });
  });

  describe('Real-World Integration Scenario', () => {
    it('should handle complex real-world codebase patterns and dependencies', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      console.log('🚀 Starting real-world integration scenario...');

      // Initialize for complex real-world analysis
      await (tools.initialize as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'E2E Test: Real-world SaaS platform analysis - multi-tenant architecture with complex integrations'
        }),
        token
      );

      // Phase 1: Core Platform Services
      const coreServices = [
        {
          id: 'TenantManager',
          type: 'Service',
          filePath: '/src/core/tenant/TenantManager.ts',
          businessContext: 'Multi-tenant isolation and management with schema separation',
          chainContext: 'Core platform - tenant orchestration layer'
        },
        {
          id: 'IdentityProvider',
          type: 'Service',
          filePath: '/src/core/identity/IdentityProvider.ts',
          businessContext: 'Federated identity management with SAML/OAuth2 integration',
          chainContext: 'Core platform - identity and access management'
        },
        {
          id: 'APIGateway',
          type: 'Gateway',
          filePath: '/src/infrastructure/gateway/APIGateway.ts',
          businessContext: 'API routing, rate limiting, and tenant context injection',
          chainContext: 'Infrastructure layer - request orchestration'
        }
      ];

      for (const service of coreServices) {
        await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity: service }),
          token
        );
      }

      // Phase 2: Business Domain Services
      const domainServices = [
        {
          id: 'SubscriptionEngine',
          type: 'Service',
          filePath: '/src/domains/billing/SubscriptionEngine.ts',
          businessContext: 'Subscription lifecycle management with plan upgrades and billing cycles',
          chainContext: 'Business domain - monetization layer'
        },
        {
          id: 'WorkflowOrchestrator',
          type: 'Service',
          filePath: '/src/domains/workflow/WorkflowOrchestrator.ts',
          businessContext: 'Complex business process automation with state machines',
          chainContext: 'Business domain - process automation layer'
        },
        {
          id: 'IntegrationHub',
          type: 'Service',
          filePath: '/src/domains/integrations/IntegrationHub.ts',
          businessContext: 'Third-party API integrations with webhook management',
          chainContext: 'Business domain - external connectivity layer'
        }
      ];

      for (const service of domainServices) {
        await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity: service }),
          token
        );
      }

      // Phase 3: Data and Analytics Layer
      const dataServices = [
        {
          id: 'DataLake',
          type: 'Repository',
          filePath: '/src/data/lake/DataLakeManager.ts',
          businessContext: 'Big data storage and processing with tenant data isolation',
          chainContext: 'Data layer - analytics and reporting foundation'
        },
        {
          id: 'EventSourcing',
          type: 'Repository',
          filePath: '/src/data/events/EventSourcingRepository.ts',
          businessContext: 'Event-driven architecture with CQRS pattern implementation',
          chainContext: 'Data layer - event persistence and replay'
        },
        {
          id: 'CacheManager',
          type: 'Utility',
          filePath: '/src/data/cache/CacheManager.ts',
          businessContext: 'Distributed caching with Redis clustering and invalidation strategies',
          chainContext: 'Data layer - performance optimization'
        }
      ];

      for (const service of dataServices) {
        await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity: service }),
          token
        );
      }

      // Phase 4: Frontend and Client Services
      const clientServices = [
        {
          id: 'MicroFrontendShell',
          type: 'Component',
          filePath: '/src/frontend/shell/MicroFrontendShell.tsx',
          businessContext: 'Micro-frontend orchestration with module federation',
          chainContext: 'Frontend layer - application shell and routing'
        },
        {
          id: 'StateManager',
          type: 'Utility',
          filePath: '/src/frontend/state/StateManager.ts',
          businessContext: 'Global state management with Redux and real-time synchronization',
          chainContext: 'Frontend layer - client state coordination'
        },
        {
          id: 'WebSocketManager',
          type: 'Service',
          filePath: '/src/realtime/WebSocketManager.ts',
          businessContext: 'Real-time communication with connection pooling and reconnection logic',
          chainContext: 'Communication layer - bidirectional data flow'
        }
      ];

      for (const service of clientServices) {
        await (tools.addEntity as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity: service }),
          token
        );
      }

      console.log('✅ Complex service architecture discovered');

      // Phase 5: Map Complex Dependency Relationships
      const complexRelationships = [
        // Cross-cutting concerns
        { from: 'APIGateway', to: 'TenantManager', type: 'USES', strength: 0.95 },
        { from: 'APIGateway', to: 'IdentityProvider', type: 'USES', strength: 0.9 },
        
        // Business process flows
        { from: 'SubscriptionEngine', to: 'WorkflowOrchestrator', type: 'TRIGGERS', strength: 0.8 },
        { from: 'WorkflowOrchestrator', to: 'IntegrationHub', type: 'USES', strength: 0.7 },
        
        // Data flow patterns
        { from: 'SubscriptionEngine', to: 'EventSourcing', type: 'PUBLISHES_TO', strength: 0.85 },
        { from: 'EventSourcing', to: 'DataLake', type: 'FEEDS_INTO', strength: 0.8 },
        
        // Performance optimizations
        { from: 'TenantManager', to: 'CacheManager', type: 'DEPENDS_ON', strength: 0.9 },
        { from: 'IdentityProvider', to: 'CacheManager', type: 'DEPENDS_ON', strength: 0.85 },
        
        // Frontend integration
        { from: 'MicroFrontendShell', to: 'APIGateway', type: 'CALLS', strength: 0.95 },
        { from: 'StateManager', to: 'WebSocketManager', type: 'LISTENS_TO', strength: 0.8 },
        { from: 'WebSocketManager', to: 'EventSourcing', type: 'SUBSCRIBES_TO', strength: 0.75 }
      ];

      for (const rel of complexRelationships) {
        await (tools.addRelationship as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: rel.from,
              toEntityId: rel.to,
              relationshipType: rel.type,
              strength: rel.strength,
              discoveryMethod: 'architectural_analysis'
            }
          }),
          token
        );
      }

      console.log('✅ Complex dependency relationships mapped');

      // Phase 6: Advanced Chain Validation
      const advancedValidation = await (tools.validate as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          validationScope: 'architectural',
          includeCircularDependencyCheck: true,
          includeTenantIsolationValidation: true,
          includePerformanceBottleneckAnalysis: true
        }),
        token
      );

      assert.ok(advancedValidation);
      console.log('✅ Advanced architectural validation completed');

      // Phase 7: Comprehensive Real-World Report
      const architecturalReport = await (tools.report as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          format: 'json',
          includeArchitecturalPatterns: true,
          includeScalabilityAnalysis: true,
          includeTenantIsolationReport: true,
          includeIntegrationMapping: true,
          includePerformanceRecommendations: true
        }),
        token
      );

      assert.ok(architecturalReport);
      const reportText = architecturalReport.content[0].value;

      // Verify comprehensive real-world analysis
      assert.ok(reportText.includes('TenantManager'), 'Should analyze multi-tenancy');
      assert.ok(reportText.includes('IdentityProvider'), 'Should analyze identity management');
      assert.ok(reportText.includes('APIGateway'), 'Should analyze API infrastructure');
      assert.ok(reportText.includes('EventSourcing'), 'Should analyze event-driven patterns');
      assert.ok(reportText.includes('MicroFrontendShell'), 'Should analyze frontend architecture');

      console.log('✅ Comprehensive real-world architectural analysis completed');
      console.log('🎉 Real-world integration scenario completed successfully!');
    });
  });
});
