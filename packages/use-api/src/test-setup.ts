import { afterEach } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'

// Automatically unmount Vue components after each test to prevent event listener accumulation.
enableAutoUnmount(afterEach)
